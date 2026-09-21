import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export const ANALYZER_VERSION = 'media-foundation-1.0.0';
export const PACKAGE_SCHEMA_VERSION = '1.0.0';
export const REQUIRED_LANES = [
  'spoken_audio',
  'speaker_turns',
  'burned_in_captions',
  'other_on_screen_text',
  'visible_actions_subjects_ui_state',
  'visual_shot_state_changes'
];

export class IntakeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'IntakeError';
    this.code = code;
    this.details = details;
  }
}

function now() {
  return new Date().toISOString();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function runCommand(command, args, { allowFailure = false, maxOutputBytes = 8_000_000 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const collect = (target, chunk, count, label) => {
      const next = count + chunk.length;
      if (next > maxOutputBytes) {
        child.kill('SIGKILL');
        rejectPromise(new IntakeError('PROCESS_OUTPUT_LIMIT', `${label} exceeded the output limit.`, { command }));
        return count;
      }
      target.push(chunk);
      return next;
    };
    child.stdout.on('data', chunk => { stdoutBytes = collect(stdout, chunk, stdoutBytes, 'stdout'); });
    child.stderr.on('data', chunk => { stderrBytes = collect(stderr, chunk, stderrBytes, 'stderr'); });
    child.on('error', error => rejectPromise(new IntakeError('PROCESS_START_FAILED', `${command} could not start.`, { cause: error.message })));
    child.on('close', code => {
      const result = { code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') };
      if (code !== 0 && !allowFailure) {
        rejectPromise(new IntakeError('PROCESS_FAILED', `${command} exited with code ${code}.`, { ...result, command, args }));
      } else {
        resolvePromise(result);
      }
    });
  });
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function probeMedia(path) {
  const result = await runCommand('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]);
  let probe;
  try {
    probe = JSON.parse(result.stdout);
  } catch {
    throw new IntakeError('PROBE_INVALID_OUTPUT', 'ffprobe returned invalid JSON.');
  }
  const durationSeconds = Number(probe.format?.duration);
  const videoStreams = (probe.streams || []).filter(stream => stream.codec_type === 'video');
  const audioStreams = (probe.streams || []).filter(stream => stream.codec_type === 'audio');
  if (!videoStreams.length || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new IntakeError('UNSUPPORTED_MEDIA', 'The source is not a supported video with a measurable duration.');
  }
  return {
    duration_seconds: durationSeconds,
    format_name: probe.format?.format_name || null,
    size_bytes: Number(probe.format?.size) || (await stat(path)).size,
    video_streams: videoStreams.map(stream => ({
      index: stream.index,
      codec: stream.codec_name || null,
      width: stream.width || null,
      height: stream.height || null,
      frame_rate: stream.avg_frame_rate || null,
      duration_seconds: Number(stream.duration) || null
    })),
    audio_streams: audioStreams.map(stream => ({
      index: stream.index,
      codec: stream.codec_name || null,
      channels: stream.channels || null,
      sample_rate: Number(stream.sample_rate) || null,
      duration_seconds: Number(stream.duration) || null
    }))
  };
}

function parseProgress(stdout) {
  const values = {};
  for (const line of stdout.split(/\r?\n/)) {
    const split = line.indexOf('=');
    if (split > 0) values[line.slice(0, split)] = line.slice(split + 1);
  }
  const microseconds = Number(values.out_time_us || values.out_time_ms || 0);
  return { final_out_time_seconds: microseconds / 1_000_000, terminal_progress: values.progress || null };
}

export async function verifyCompleteDecode(path, durationSeconds) {
  const result = await runCommand('ffmpeg', [
    '-v', 'error', '-i', path, '-map', '0:v?', '-map', '0:a?', '-f', 'null', '-',
    '-progress', 'pipe:1', '-nostats'
  ], { allowFailure: true });
  const progress = parseProgress(result.stdout);
  const toleranceSeconds = Math.max(0.5, Math.min(2, durationSeconds * 0.02));
  const reachedEnd = progress.final_out_time_seconds >= durationSeconds - toleranceSeconds;
  if (result.code !== 0 || !reachedEnd || progress.terminal_progress !== 'end') {
    throw new IntakeError('DECODE_INCOMPLETE', 'The source did not decode cleanly from beginning to end.', {
      ffmpeg_exit_code: result.code,
      duration_seconds: durationSeconds,
      ...progress,
      stderr: result.stderr.slice(-4000)
    });
  }
  return {
    state: 'complete',
    method: 'ffmpeg_full_stream_decode',
    duration_seconds: durationSeconds,
    decoded_through_seconds: progress.final_out_time_seconds,
    tolerance_seconds: toleranceSeconds,
    ffmpeg_exit_code: result.code,
    verified_at: now()
  };
}

function urlFailure(status, url) {
  if ([401, 403, 429].includes(status)) {
    return new IntakeError('AUTOMATED_ACCESS_BLOCKED', `Automated retrieval was blocked with HTTP ${status}.`, { status, url });
  }
  if ([404, 410].includes(status)) {
    return new IntakeError('SOURCE_UNAVAILABLE', `The source returned HTTP ${status}.`, { status, url });
  }
  return new IntakeError('TEMPORARILY_UNAVAILABLE', `The source returned HTTP ${status}.`, { status, url });
}

export async function resolveInput(input, { fetchImpl = fetch, maxBytes = 8_000_000_000 } = {}) {
  if (!/^https?:\/\//i.test(input)) {
    const path = resolve(input);
    if (!await exists(path)) throw new IntakeError('SOURCE_UNAVAILABLE', 'The input file does not exist.', { path });
    const info = await stat(path);
    if (!info.isFile()) throw new IntakeError('UNSUPPORTED_MEDIA', 'The input path is not a file.', { path });
    return {
      path,
      temporary_root: null,
      source: { type: 'direct_file', original_filename: basename(path), source_url: null, retrieval_state: 'local_file_accessible' }
    };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new IntakeError('SOURCE_INVALID', 'The source URL is invalid.');
  }
  let response;
  try {
    response = await fetchImpl(url, { redirect: 'follow', headers: { accept: 'video/*,application/octet-stream;q=0.9' } });
  } catch (error) {
    throw new IntakeError('TEMPORARILY_UNAVAILABLE', 'The source could not be reached.', { cause: error.message, url: String(url) });
  }
  if (!response.ok) throw urlFailure(response.status, String(url));
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('video/') && !contentType.includes('application/octet-stream')) {
    throw new IntakeError('UNSUPPORTED_SOURCE', 'The URL was retrievable but did not return direct video bytes.', { content_type: contentType, url: String(url) });
  }
  const declaredBytes = Number(response.headers.get('content-length') || 0);
  if (declaredBytes > maxBytes) throw new IntakeError('SOURCE_TOO_LARGE', 'The source exceeds the configured intake limit.', { declared_bytes: declaredBytes, max_bytes: maxBytes });
  const root = await mkdtemp(join(tmpdir(), 'abc-video-intake-'));
  const extension = extname(url.pathname).slice(0, 8) || '.video';
  const path = join(root, `source${extension}`);
  let bytes = 0;
  const output = await open(path, 'w');
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        throw new IntakeError('SOURCE_TOO_LARGE', 'The downloaded source exceeded the configured intake limit.', { max_bytes: maxBytes });
      }
      await output.write(chunk);
    }
  } catch (error) {
    await output.close();
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  await output.close();
  return {
    path,
    temporary_root: root,
    source: {
      type: 'direct_media_url',
      original_filename: basename(url.pathname) || null,
      source_url: String(url),
      retrieval_state: 'retrieved_direct_media',
      response_content_type: contentType,
      retrieved_bytes: bytes
    }
  };
}

async function extractFrames(sourcePath, framesDirectory, durationSeconds, intervalSeconds) {
  await mkdir(framesDirectory, { recursive: true });
  await runCommand('ffmpeg', [
    '-v', 'error', '-i', sourcePath, '-vf', `fps=1/${intervalSeconds}`, '-q:v', '4',
    join(framesDirectory, 'frame-%06d.jpg')
  ]);
  const names = (await readdir(framesDirectory)).filter(name => name.endsWith('.jpg')).sort();
  const frames = [];
  for (let index = 0; index < names.length; index++) {
    const name = names[index];
    frames.push({
      frame_id: name.replace('.jpg', ''),
      timestamp_seconds: Math.min(index * intervalSeconds, durationSeconds),
      timestamp_method: 'ffmpeg_fixed_cadence_filter',
      relative_path: `frames/${name}`,
      sha256: await sha256File(join(framesDirectory, name))
    });
  }
  return frames;
}

async function runOcr(frames, packageDirectory) {
  const observations = [];
  for (const frame of frames) {
    const result = await runCommand('tesseract', [join(packageDirectory, frame.relative_path), 'stdout', '--psm', '6'], { allowFailure: true });
    const text = result.stdout.replace(/\s+/g, ' ').trim();
    if (text) observations.push({
      start_seconds: frame.timestamp_seconds,
      end_seconds: frame.timestamp_seconds,
      text,
      signal_type: 'raw_ocr',
      source_frame_id: frame.frame_id,
      confidence: null,
      uncertainty: 'OCR text is an unclassified raw signal; it is not automatically spoken dialogue or a burned-in caption.'
    });
  }
  return observations;
}

async function detectVisualChanges(sourcePath) {
  const result = await runCommand('ffmpeg', [
    '-hide_banner', '-i', sourcePath, '-vf', "select='gt(scene,0.30)',showinfo", '-an', '-f', 'null', '-'
  ], { allowFailure: true, maxOutputBytes: 16_000_000 });
  if (result.code !== 0) return { state: 'failed', observations: [], error: result.stderr.slice(-2000) };
  const observations = [];
  for (const match of result.stderr.matchAll(/pts_time:([0-9.]+)/g)) {
    observations.push({ timestamp_seconds: Number(match[1]), signal_type: 'scene_change_candidate', threshold: 0.30 });
  }
  return { state: 'completed', observations };
}

function makeEvidence({ frames, ocr, changes, hasAudio }) {
  return {
    schema_version: PACKAGE_SCHEMA_VERSION,
    lanes: {
      spoken_audio: {
        state: hasAudio ? 'extractor_unavailable' : 'not_present',
        verification_modality: hasAudio ? null : 'ffprobe_no_audio_stream',
        observations: [],
        uncertainty: hasAudio ? 'No ASR extractor is bundled in this foundation; exact speech is not preserved yet.' : null
      },
      speaker_turns: {
        state: hasAudio ? 'extractor_unavailable' : 'not_present',
        verification_modality: null,
        observations: [],
        uncertainty: hasAudio ? 'Speaker/turn recovery requires a diarization-capable extractor.' : null
      },
      burned_in_captions: {
        state: ocr.length ? 'unclassified_raw_signal' : 'none_observed_at_sampling_cadence',
        verification_modality: 'tesseract_ocr_on_sampled_frames',
        observations: [],
        uncertainty: 'Raw OCR has not been classified as captions versus other on-screen text.'
      },
      other_on_screen_text: {
        state: ocr.length ? 'unclassified_raw_signal' : 'none_observed_at_sampling_cadence',
        verification_modality: 'tesseract_ocr_on_sampled_frames',
        observations: ocr,
        uncertainty: 'Sampling can miss transient text; OCR is not dialogue reconstruction.'
      },
      visible_actions_subjects_ui_state: {
        state: 'raw_frames_only',
        verification_modality: 'ffmpeg_fixed_cadence_frames',
        observations: frames,
        uncertainty: 'Frames are preserved, but semantic action/subject/UI-state extraction is not yet implemented.'
      },
      visual_shot_state_changes: {
        state: changes.state,
        verification_modality: 'ffmpeg_scene_score',
        observations: changes.observations,
        uncertainty: 'Scene-score candidates are not semantic descriptions of the change.'
      }
    },
    modality_conflicts: [],
    synchronized_timeline: [
      ...ocr.map(item => ({
        start_seconds: item.start_seconds,
        end_seconds: item.end_seconds,
        lane: 'other_on_screen_text',
        evidence: item.text,
        signal_type: item.signal_type,
        source_frame_id: item.source_frame_id,
        uncertainty: item.uncertainty
      })),
      ...changes.observations.map(item => ({
        start_seconds: item.timestamp_seconds,
        end_seconds: item.timestamp_seconds,
        lane: 'visual_shot_state_changes',
        evidence: 'Scene-change candidate',
        signal_type: item.signal_type,
        uncertainty: 'Automated visual-change signal only.'
      }))
    ].sort((a, b) => a.start_seconds - b.start_seconds)
  };
}

export function evaluateSafeDeletion({ manifest, evidence, readback }) {
  const laneStates = Object.fromEntries(REQUIRED_LANES.map(name => [name, evidence?.lanes?.[name]?.state || 'missing']));
  const allowedCompleteStates = new Set(['completed', 'not_present']);
  const requiredEvidenceComplete = Object.values(laneStates).every(state => allowedCompleteStates.has(state));
  const checks = {
    required_evidence_extraction_completed: requiredEvidenceComplete,
    durable_evidence_package_written: manifest?.persistence?.write_state === 'written',
    evidence_package_read_back_verified: readback?.verified === true,
    manifest_records_source_retention_state: Boolean(manifest?.raw_source?.retention_state)
  };
  return {
    safe_to_delete_original: Object.values(checks).every(Boolean),
    checks,
    lane_states: laneStates,
    reason: requiredEvidenceComplete ? null : 'One or more required evidence lanes are incomplete, raw-only, unclassified, or missing.'
  };
}

function validatePackageShape(manifest, evidence) {
  const missing = [];
  for (const field of ['package_id', 'source', 'content_sha256', 'duration_seconds', 'processing', 'coverage', 'persistence', 'raw_source']) {
    if (manifest?.[field] === undefined || manifest?.[field] === null) missing.push(`manifest.${field}`);
  }
  for (const lane of REQUIRED_LANES) if (!evidence?.lanes?.[lane]) missing.push(`evidence.lanes.${lane}`);
  if (!Array.isArray(evidence?.synchronized_timeline)) missing.push('evidence.synchronized_timeline');
  if (missing.length) throw new IntakeError('EVIDENCE_PACKAGE_INCOMPLETE', 'The evidence package is missing required components.', { missing });
}

export async function verifyEvidencePackage(packageDirectory) {
  let manifest;
  let evidence;
  try {
    manifest = JSON.parse(await readFile(join(packageDirectory, 'manifest.json'), 'utf8'));
    evidence = JSON.parse(await readFile(join(packageDirectory, 'evidence.json'), 'utf8'));
  } catch (error) {
    throw new IntakeError('PERSISTENCE_READBACK_FAILED', 'The evidence package could not be read back and parsed.', { cause: error.message });
  }
  validatePackageShape(manifest, evidence);
  const evidenceText = JSON.stringify(evidence, null, 2) + '\n';
  const actualEvidenceSha256 = await sha256Text(evidenceText);
  if (actualEvidenceSha256 !== manifest.persistence.evidence_sha256) {
    throw new IntakeError('PERSISTENCE_READBACK_FAILED', 'The read-back evidence digest does not match the manifest.', {
      expected: manifest.persistence.evidence_sha256,
      actual: actualEvidenceSha256
    });
  }
  return { verified: true, package_id: manifest.package_id, evidence_sha256: actualEvidenceSha256, verified_at: now(), manifest, evidence };
}

export async function processVideo(input, {
  outputRoot = '.video-analysis',
  frameIntervalSeconds = 5,
  fetchImpl = fetch,
  beforeReadback = null
} = {}) {
  const startedAt = now();
  const resolved = await resolveInput(input, { fetchImpl });
  try {
    const contentSha256 = await sha256File(resolved.path);
    const probe = await probeMedia(resolved.path);
    const decode = await verifyCompleteDecode(resolved.path, probe.duration_seconds);
    const packageId = `video-${contentSha256.slice(0, 20)}`;
    const root = resolve(outputRoot);
    const finalDirectory = join(root, packageId);
    const stagingDirectory = join(root, `.${packageId}-${randomUUID()}.staging`);
    await mkdir(stagingDirectory, { recursive: true });

    const frames = await extractFrames(resolved.path, join(stagingDirectory, 'frames'), probe.duration_seconds, frameIntervalSeconds);
    const ocr = await runOcr(frames, stagingDirectory);
    const changes = await detectVisualChanges(resolved.path);
    const evidence = makeEvidence({ frames, ocr, changes, hasAudio: probe.audio_streams.length > 0 });
    const evidenceText = JSON.stringify(evidence, null, 2) + '\n';
    const manifest = {
      schema_version: PACKAGE_SCHEMA_VERSION,
      package_id: packageId,
      source: resolved.source,
      content_sha256: contentSha256,
      duration_seconds: probe.duration_seconds,
      media_probe: probe,
      processing: {
        state: 'evidence_foundation_extracted',
        analyzer_version: ANALYZER_VERSION,
        started_at: startedAt,
        completed_at: now()
      },
      coverage: {
        state: 'source_decoded_end_to_end',
        decode,
        visual_sampling: {
          state: 'sampled_not_frame_exhaustive',
          interval_seconds: frameIntervalSeconds,
          frame_count: frames.length
        },
        transcript: probe.audio_streams.length ? 'not_extracted' : 'not_present',
        semantic_visual_evidence: 'not_extracted'
      },
      evidence_package: {
        identity: packageId,
        relative_manifest_path: 'manifest.json',
        relative_evidence_path: 'evidence.json'
      },
      persistence: {
        write_state: 'written',
        readback_state: 'pending',
        evidence_sha256: await sha256Text(evidenceText)
      },
      raw_source: {
        retention_state: resolved.source.type === 'direct_file' ? 'original_preserved_not_managed' : 'temporary_download_pending_cleanup',
        automatically_deleted: false
      }
    };
    await writeFile(join(stagingDirectory, 'evidence.json'), evidenceText);
    await writeFile(join(stagingDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await mkdir(root, { recursive: true });
    if (await exists(finalDirectory)) await rm(finalDirectory, { recursive: true, force: true });
    await rename(stagingDirectory, finalDirectory);
    if (beforeReadback) await beforeReadback(finalDirectory);
    const readback = await verifyEvidencePackage(finalDirectory);
    readback.manifest.persistence.readback_state = 'verified';
    readback.manifest.persistence.readback_verified_at = readback.verified_at;
    readback.manifest.raw_source.retention_state = resolved.source.type === 'direct_file'
      ? 'original_preserved_not_managed'
      : 'temporary_download_deleted_after_verified_package';
    const deletionGate = evaluateSafeDeletion({ manifest: readback.manifest, evidence: readback.evidence, readback });
    readback.manifest.safe_deletion_gate = deletionGate;
    await writeFile(join(finalDirectory, 'manifest.json'), JSON.stringify(readback.manifest, null, 2) + '\n');
    const finalReadback = await verifyEvidencePackage(finalDirectory);
    return {
      package_directory: finalDirectory,
      manifest: finalReadback.manifest,
      evidence: finalReadback.evidence,
      readback: { verified: true, verified_at: finalReadback.verified_at }
    };
  } finally {
    if (resolved.temporary_root) await rm(resolved.temporary_root, { recursive: true, force: true });
  }
}
