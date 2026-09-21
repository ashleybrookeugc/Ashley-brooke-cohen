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
    '-vf', "drawtext=text='FRAME EVIDENCE':fontcolor=white:fontsize=24:x=20:y=100",
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p'
  ];
  if (audio) args.push('-c:a', 'aac', '-shortest');
  args.push(path);
  await runCommand('ffmpeg', args);
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
  assert.equal(result.manifest.persistence.readback_state, 'verified');
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
  const result = await processVideo(`http://127.0.0.1:${port}/served.mp4`, {
    outputRoot: join(root, 'url-packages'),
    frameIntervalSeconds: 1
  });
  assert.equal(result.manifest.source.type, 'direct_media_url');
  assert.equal(result.manifest.coverage.decode.state, 'complete');
  assert.equal(result.manifest.persistence.readback_state, 'verified');
  assert.equal(result.manifest.raw_source.retention_state, 'temporary_download_deleted_after_verified_package');
});

test('safe-delete gate requires completed lanes, write, read-back, and retention state', () => {
  const completedEvidence = {
    lanes: Object.fromEntries(REQUIRED_LANES.map(name => [name, { state: 'completed' }]))
  };
  const manifest = { persistence: { write_state: 'written' }, raw_source: { retention_state: 'original_preserved_not_managed' } };
  assert.equal(evaluateSafeDeletion({ manifest, evidence: completedEvidence, readback: { verified: true } }).safe_to_delete_original, true);
  completedEvidence.lanes.spoken_audio.state = 'extractor_unavailable';
  assert.equal(evaluateSafeDeletion({ manifest, evidence: completedEvidence, readback: { verified: true } }).safe_to_delete_original, false);
});
