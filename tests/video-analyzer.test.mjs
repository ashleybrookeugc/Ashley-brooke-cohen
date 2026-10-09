import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  IntakeError,
  REQUIRED_LANES,
  evaluateSafeDeletion,
  processVideo,
  resolveInput,
  runCommand,
  verifyEvidencePackage
} from '../tools/video-analyzer/core.mjs';
import { buildSemanticVisualObservations } from '../tools/video-analyzer/understanding.mjs';

async function fixtureRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'abc-video-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function makeVideo(path, { seconds = 2, audio = false } = {}) {
  const inputs = ['-f', 'lavfi', '-i', `color=c=navy:s=320x240:d=${seconds}:r=12`];
  if (audio) inputs.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`);
  const args = [
    '-y', ...inputs,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p'
  ];
  if (audio) args.push('-c:a', 'aac', '-shortest');
  args.push(path);
  await runCommand('ffmpeg', args);
}

async function makeDialogueVideo(path, { caption = 'I think this is fair' } = {}) {
  assert.equal(caption, 'I think this is fair');
  const assets = join(process.cwd(), '.fixture-assets');
  await runCommand('ffmpeg', [
    '-y',
    '-loop', '1', '-framerate', '12', '-t', '1', '-i', join(assets, 'dialogue-base.png'),
    '-loop', '1', '-framerate', '12', '-t', '0.4', '-i', join(assets, 'dialogue-flash.png'),
    '-loop', '1', '-framerate', '12', '-t', '5.6', '-i', join(assets, 'dialogue-base.png'),
    '-i', join(assets, 'speech-one.aiff'),
    '-f', 'lavfi', '-t', '1.2', '-i', 'anullsrc=r=16000:cl=mono',
    '-i', join(assets, 'speech-two.aiff'),
    '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v];[3:a][4:a][5:a]concat=n=3:v=0:a=1[a]',
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path
  ]);
}

async function makeScreenStateVideo(path) {
  const assets = join(process.cwd(), '.fixture-assets');
  await runCommand('ffmpeg', [
    '-y',
    '-loop', '1', '-framerate', '12', '-t', '1.45', '-i', join(assets, 'screen-edit.png'),
    '-loop', '1', '-framerate', '12', '-t', '1.55', '-i', join(assets, 'screen-watch.png'),
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path
  ]);
}

function assertIntakeCode(error, code) {
  assert.ok(error instanceof IntakeError);
  assert.equal(error.code, code);
  return true;
}

test('direct-file intake decodes completely and persists a verified evidence package', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'small-real-fixture.mp4');
  await makeVideo(source);
  const result = await processVideo(source, { outputRoot: join(root, 'packages'), frameIntervalSeconds: 0.5 });

  assert.equal(result.manifest.source.type, 'direct_file');
  assert.match(result.manifest.content_sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.manifest.coverage.state, 'source_decoded_end_to_end');
  assert.equal(result.manifest.coverage.decode.state, 'complete');
  assert.equal(result.manifest.persistence.local.readback_state, 'verified');
  assert.equal(result.manifest.persistence.remote.readback_state, 'not_run');
  assert.equal(result.manifest.raw_source.automatically_deleted, false);
  assert.ok(result.manifest.coverage.visual_sampling.frame_count >= 3);
  for (const lane of REQUIRED_LANES) assert.ok(result.evidence.lanes[lane]);
  assert.equal((await verifyEvidencePackage(result.package_directory)).verified, true);
  assert.equal(result.manifest.safe_deletion_gate.safe_to_delete_original, false);
});

test('incomplete/truncated input fails complete-source decode', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'truncated.mp4');
  await makeVideo(source, { seconds: 3 });
  const bytes = (await readFile(source)).length;
  await truncate(source, Math.floor(bytes * 0.45));
  await assert.rejects(
    processVideo(source, { outputRoot: join(root, 'packages') }),
    error => ['PROCESS_FAILED', 'DECODE_INCOMPLETE', 'UNSUPPORTED_MEDIA'].includes(error.code)
  );
});

test('failed persistence/read-back is detected after a successful write', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'readback-failure.mp4');
  await makeVideo(source);
  await assert.rejects(
    processVideo(source, {
      outputRoot: join(root, 'packages'),
      beforeReadback: async packageDirectory => writeFile(join(packageDirectory, 'evidence.json'), '{"silently":"truncated"}')
    }),
    error => assertIntakeCode(error, 'EVIDENCE_PACKAGE_INCOMPLETE')
  );
});

test('evidence package missing a required lane is rejected', async t => {
  const root = await fixtureRoot(t);
  const packageDirectory = join(root, 'broken-package');
  await mkdir(packageDirectory);
  await writeFile(join(packageDirectory, 'manifest.json'), JSON.stringify({
    package_id: 'broken', source: {}, content_sha256: 'x', duration_seconds: 1,
    processing: {}, coverage: {}, persistence: { evidence_sha256: 'x' }, raw_source: {}
  }));
  await writeFile(join(packageDirectory, 'evidence.json'), JSON.stringify({ lanes: {}, synchronized_timeline: [] }));
  await assert.rejects(
    verifyEvidencePackage(packageDirectory),
    error => assertIntakeCode(error, 'EVIDENCE_PACKAGE_INCOMPLETE')
  );
});

test('URL intake distinguishes access-blocked, unavailable, temporary, and unsupported sources', async t => {
  const server = createServer((request, response) => {
    if (request.url === '/blocked') response.writeHead(403).end('blocked');
    else if (request.url === '/missing') response.writeHead(404).end('missing');
    else if (request.url === '/temporary') response.writeHead(503).end('temporary');
    else response.writeHead(200, { 'content-type': 'text/html' }).end('<html>not direct media</html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  const url = path => `http://127.0.0.1:${port}${path}`;

  await assert.rejects(resolveInput(url('/blocked')), error => assertIntakeCode(error, 'AUTOMATED_ACCESS_BLOCKED'));
  await assert.rejects(resolveInput(url('/missing')), error => assertIntakeCode(error, 'SOURCE_UNAVAILABLE'));
  await assert.rejects(resolveInput(url('/temporary')), error => assertIntakeCode(error, 'TEMPORARILY_UNAVAILABLE'));
  await assert.rejects(resolveInput(url('/html')), error => assertIntakeCode(error, 'UNSUPPORTED_SOURCE'));
});

test('retrievable direct-media URL is processed as real media', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'served.mp4');
  await makeVideo(source);
  const sourceBytes = await readFile(source);
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'video/mp4', 'content-length': sourceBytes.length });
    response.end(sourceBytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  const local = await processVideo(source, {
    outputRoot: join(root, 'local-packages'),
    frameIntervalSeconds: 1
  });
  const result = await processVideo(`http://127.0.0.1:${port}/served.mp4`, {
    outputRoot: join(root, 'url-packages'),
    frameIntervalSeconds: 1
  });
  assert.equal(result.manifest.source.type, 'direct_media_url');
  assert.equal(result.manifest.coverage.decode.state, 'complete');
  assert.equal(result.manifest.persistence.local.readback_state, 'verified');
  assert.equal(result.manifest.raw_source.retention_state, 'temporary_download_deleted_after_verified_package');
  assert.equal(result.manifest.media_asset.media_asset_id, local.manifest.media_asset.media_asset_id);
  assert.equal(result.manifest.media_asset.content_version_sha256, local.manifest.media_asset.content_version_sha256);
});

test('safe-delete gate requires completed lanes, write, read-back, and retention state', () => {
  const completedEvidence = {
    lanes: Object.fromEntries(REQUIRED_LANES.map(name => [name, { state: 'completed' }]))
  };
  const manifest = {
    persistence: {
      local: { write_state: 'written', readback_state: 'verified' },
      remote: { write_state: 'written', readback_state: 'verified', access_state: 'authorized_retrieval_verified' }
    },
    raw_source: { retention_state: 'original_preserved_not_managed' }
  };
  assert.equal(evaluateSafeDeletion({ manifest, evidence: completedEvidence, readback: { verified: true } }).safe_to_delete_original, true);
  completedEvidence.lanes.spoken_audio.state = 'extractor_unavailable';
  assert.equal(evaluateSafeDeletion({ manifest, evidence: completedEvidence, readback: { verified: true } }).safe_to_delete_original, false);
});

test('ASR preserves tested connector words and negation with versioned word timestamps', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'dialogue.mp4');
  await makeDialogueVideo(source);
  const result = await processVideo(source, { outputRoot: join(root, 'packages'), frameIntervalSeconds: 0.25 });
  const spoken = result.evidence.lanes.spoken_audio;
  assert.equal(spoken.state, 'completed');
  assert.equal(spoken.extractor.name, 'PocketSphinx');
  assert.equal(spoken.extractor.package_version, '5.0.4');
  assert.equal(spoken.extractor.direct_audio_audition, false);
  assert.equal(spoken.observations[0].text, 'i do not think this is fair because you know the answer');
  assert.equal(spoken.observations[1].text, 'why not because i already checked it');
  assert.ok(spoken.observations.every(span => span.words.every(word => Number.isFinite(word.start_seconds) && Number.isFinite(word.confidence))));
  const turns = result.evidence.lanes.speaker_turns;
  assert.equal(turns.state, 'turn_boundaries_only');
  assert.equal(turns.observations.length, 2);
  assert.ok(turns.observations[1].start_seconds > turns.observations[0].end_seconds);
  assert.ok(turns.observations.every(turn => turn.speaker_label === 'speaker_unknown'));
});

test('ASR unavailable and ASR failure remain explicit when audio requires a transcript', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'audio.mp4');
  await makeDialogueVideo(source);
  const unavailable = await processVideo(source, {
    outputRoot: join(root, 'unavailable'), frameIntervalSeconds: 1, asrPython: join(root, 'missing-python')
  });
  assert.equal(unavailable.evidence.lanes.spoken_audio.state, 'extractor_unavailable');
  assert.equal(unavailable.manifest.safe_deletion_gate.safe_to_delete_original, false);
  const failed = await processVideo(source, {
    outputRoot: join(root, 'failed'), frameIntervalSeconds: 1, asrPython: '/usr/bin/false'
  });
  assert.equal(failed.evidence.lanes.spoken_audio.state, 'extractor_failed');
  assert.equal(failed.evidence.lanes.spoken_audio.failure.code, 'ASR_FAILED');
});

test('OCR classifies caption-like and unrelated UI text, retains transient text, and preserves disagreement', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'ocr-disagreement.mp4');
  await makeDialogueVideo(source, { caption: 'I think this is fair' });
  const result = await processVideo(source, { outputRoot: join(root, 'packages'), frameIntervalSeconds: 0.25 });
  const captions = result.evidence.lanes.burned_in_captions.observations;
  const other = result.evidence.lanes.other_on_screen_text.observations;
  assert.ok(captions.some(item => /think this is fair/i.test(item.text)));
  assert.ok(other.some(item => /EXPORT/i.test(item.text)));
  assert.ok(other.some(item => /FLASH NOTICE/i.test(item.text)));
  assert.ok(result.evidence.modality_conflicts.some(item => item.type === 'spoken_caption_disagreement' && item.state === 'unresolved'));
});

test('semantic sampled screen states distinguish workflow candidate, unrelated browsing candidate, and disclose limits', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'screen-states.mp4');
  await makeScreenStateVideo(source);
  const result = await processVideo(source, { outputRoot: join(root, 'packages'), frameIntervalSeconds: 0.5 });
  const observations = result.evidence.lanes.visible_actions_subjects_ui_state.observations;
  assert.ok(observations.some(item => item.activity.state === 'editing_workflow_candidate'));
  assert.ok(observations.some(item => item.activity.state === 'unrelated_browsing_watching_candidate'));
  assert.match(result.evidence.sampling_disclosure, /not frame-exhaustive/i);
  assert.ok(observations.every(item => item.uncertainty && Array.isArray(item.visible_subjects)));
});

test('F-004: meaningful regional visual change survives a globally stable frame decision', () => {
  const initial = Buffer.alloc(64 * 64, 0);
  const regionalChange = Buffer.from(initial);
  for (let y = 24; y < 32; y++) for (let x = 40; x < 48; x++) regionalChange[y * 64 + x] = 255;
  const unchanged = Buffer.from(regionalChange);
  const timestamps = [3.25, 3.75, 4.25];

  const observations = buildSemanticVisualObservations([initial, regionalChange, unchanged], timestamps, []);

  assert.equal(observations[0].state, 'initial_state');
  assert.ok(observations[1].difference_from_previous < 0.025,
    'fixture must reproduce the whole-frame stable decision that hid regional activity');
  assert.equal(observations[1].state, 'regional_visual_state_change');
  assert.equal(observations[1].start_seconds, 3.75);
  assert.equal(observations[1].regional_change.detected, true);
  assert.ok(observations[1].regional_change.max_region_difference >= 0.16);
  assert.deepEqual(observations[1].observable_actions, ['regional_visual_state_changed']);
  assert.equal(observations[2].state, 'sampled_stable_state');
  assert.equal(observations[2].start_seconds, 4.25);
  assert.equal(observations[2].regional_change.detected, false);
  assert.deepEqual(observations[2].observable_actions, []);
});

test('corrupted synchronized timeline and missing semantic evidence are rejected', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'timeline.mp4');
  await makeVideo(source);
  const result = await processVideo(source, { outputRoot: join(root, 'packages'), frameIntervalSeconds: 0.5 });
  const evidencePath = join(result.package_directory, 'evidence.json');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  evidence.synchronized_timeline[0].observation_id = 'missing-observation';
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  await assert.rejects(verifyEvidencePackage(result.package_directory), error => assertIntakeCode(error, 'SYNCHRONIZED_TIMELINE_INVALID'));

  const second = await processVideo(source, { outputRoot: join(root, 'packages-2'), frameIntervalSeconds: 0.5 });
  const secondPath = join(second.package_directory, 'evidence.json');
  const secondEvidence = JSON.parse(await readFile(secondPath, 'utf8'));
  delete secondEvidence.lanes.visible_actions_subjects_ui_state;
  await writeFile(secondPath, JSON.stringify(secondEvidence, null, 2) + '\n');
  await assert.rejects(verifyEvidencePackage(second.package_directory), error => assertIntakeCode(error, 'EVIDENCE_PACKAGE_INCOMPLETE'));
});

test('remote-store contract rejects corrupted remote read-back and local-only packages stay non-deletable', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'remote.mp4');
  await makeVideo(source);
  const local = await processVideo(source, { outputRoot: join(root, 'local'), frameIntervalSeconds: 1 });
  assert.equal(local.manifest.persistence.local.readback_state, 'verified');
  assert.equal(local.manifest.persistence.remote.access_state, 'local_only');
  assert.equal(local.manifest.safe_deletion_gate.safe_to_delete_original, false);
  await assert.rejects(processVideo(source, {
    outputRoot: join(root, 'corrupt-remote'),
    frameIntervalSeconds: 1,
    remoteStore: {
      provider: 'test-double',
      async persistPackage() { return { locator: 'remote:test/package' }; },
      async readEvidence() { return '{"corrupted":true}'; }
    }
  }), error => assertIntakeCode(error, 'REMOTE_PERSISTENCE_READBACK_FAILED'));
});


async function makeVfrVideo(path) {
  const keep = [0, 1, 2, 30, 31, 90, 91, 92, 93, 150, 210, 211, 239];
  const selectExpr = keep.map(index => `eq(n\\,${index})`).join('+');
  await runCommand('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc=duration=8:size=320x240:rate=30',
    '-vf', `select='${selectExpr}'`, '-fps_mode', 'vfr',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path
  ]);
}

async function readSourcePts(path) {
  const result = await runCommand('ffmpeg', [
    '-hide_banner', '-i', path, '-vf', 'showinfo', '-an', '-f', 'null', '-'
  ], { allowFailure: true, maxOutputBytes: 64_000_000 });
  assert.equal(result.code, 0);
  return [...result.stderr.matchAll(/pts_time:([0-9.]+)/g)].map(match => Number(match[1]));
}

test('F-003: sampled evidence carries source timestamps, not sampling-cadence timestamps', async t => {
  const root = await fixtureRoot(t);
  const source = join(root, 'vfr-source-time.mp4');
  await makeVfrVideo(source);
  const sourcePts = await readSourcePts(source);
  assert.ok(sourcePts.length >= 10, `expected a VFR fixture with irregular PTS, got ${sourcePts.length} frames`);
  const intervalSeconds = 1;
  const durationSeconds = Number((await runCommand('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', source
  ])).stdout.trim());
  const expectedSource = [];
  const expectedSample = [];
  for (let k = 0, tick = 0; tick < durationSeconds; k += 1, tick = k * intervalSeconds) {
    let selected = 0;
    for (let i = 0; i < sourcePts.length; i++) if (sourcePts[i] <= tick + 1e-6) selected = i;
    expectedSource.push(sourcePts[selected]);
    expectedSample.push(tick);
  }
  assert.ok(expectedSource.some((pts, k) => Math.abs(pts - expectedSample[k]) > 0.01),
    'fixture does not separate source time from sampling time; it cannot prove F-003');
  const result = await processVideo(source, { outputRoot: join(root, 'packages'), frameIntervalSeconds: intervalSeconds });
  const sampled = result.manifest.coverage.visual_sampling.frames;
  assert.ok(Array.isArray(sampled), 'F-003: manifest must carry per-frame source-time provenance (visual_sampling.frames)');
  assert.equal(sampled.length, expectedSource.length);
  for (let k = 0; k < sampled.length; k++) {
    assert.ok(Math.abs(sampled[k].source_timestamp_seconds - expectedSource[k]) < 1e-3,
      `frame ${k}: source_timestamp_seconds=${sampled[k].source_timestamp_seconds}, expected source pts=${expectedSource[k]}`);
    assert.ok(Math.abs(sampled[k].sample_timestamp_seconds - expectedSample[k]) < 1e-9,
      `frame ${k}: sample_timestamp_seconds must be the cadence tick`);
    assert.ok(Math.abs(sampled[k].timestamp_seconds - expectedSource[k]) < 1e-3,
      `frame ${k}: timestamp_seconds must be source-faithful (F-003), got ${sampled[k].timestamp_seconds}`);
  }
  const observations = result.evidence.lanes.visible_actions_subjects_ui_state.observations;
  assert.equal(observations.length, sampled.length);
  for (let k = 0; k < observations.length; k++) {
    assert.ok(Math.abs(observations[k].start_seconds - expectedSource[k]) < 1e-3,
      `observation ${k}: start_seconds=${observations[k].start_seconds}, expected source pts=${expectedSource[k]}`);
  }
});
