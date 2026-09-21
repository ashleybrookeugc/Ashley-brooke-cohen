import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildSemanticVisualObservations,
  buildSpeakerTurns,
  buildSynchronizedTimeline,
  classifyOcr,
  validateSynchronizedTimeline
} from './understanding.mjs';

export const ANALYZER_VERSION = 'synchronized-evidence-2.0.0';
export const PACKAGE_SCHEMA_VERSION = '2.0.0';
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
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

function runCommandBuffer(command, args, { maxOutputBytes = 32_000_000 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) {
        child.kill('SIGKILL');
        rejectPromise(new IntakeError('PROCESS_OUTPUT_LIMIT', 'Binary process output exceeded the configured limit.', { command }));
      } else stdout.push(chunk);
    });
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', error => rejectPromise(new IntakeError('PROCESS_START_FAILED', `${command} could not start.`, { cause: error.message })));
    child.on('close', code => code === 0
      ? resolvePromise({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString('utf8') })
      : rejectPromise(new IntakeError('PROCESS_FAILED', `${command} exited with code ${code}.`, { stderr: Buffer.concat(stderr).toString('utf8'), command, args })));
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

function parseTsv(tsv, frame, width, height, firstObservationIndex, extractorVersion) {
  const rows = tsv.trim().split(/\r?\n/);
  if (rows.length < 2) return [];
  const headers = rows[0].split('\t');
  const groups = new Map();
  for (const row of rows.slice(1)) {
    const cells = row.split('\t');
    const item = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    const text = String(item.text || '').trim();
    const confidence = Number(item.conf);
    if (!text || !Number.isFinite(confidence) || confidence < 0) continue;
    const key = [item.page_num, item.block_num, item.par_num, item.line_num].join(':');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      text,
      confidence,
      left: Number(item.left),
      top: Number(item.top),
      width: Number(item.width),
      height: Number(item.height)
    });
  }
  return [...groups.values()].map((items, index) => {
    const left = Math.min(...items.map(item => item.left));
    const top = Math.min(...items.map(item => item.top));
    const right = Math.max(...items.map(item => item.left + item.width));
    const bottom = Math.max(...items.map(item => item.top + item.height));
    return {
      observation_id: `ocr-${String(firstObservationIndex + index + 1).padStart(6, '0')}`,
      start_seconds: frame.timestamp_seconds,
      end_seconds: frame.timestamp_seconds,
      text: items.map(item => item.text).join(' '),
      signal_type: 'raw_ocr',
      source_frame_id: frame.frame_id,
      confidence: Number((items.reduce((sum, item) => sum + item.confidence, 0) / items.length / 100).toFixed(4)),
      bounds: { x: left / width, y: top / height, width: (right - left) / width, height: (bottom - top) / height },
      extractor: { name: 'Tesseract', version: extractorVersion, page_segmentation_mode: 11 },
      uncertainty: 'OCR is a raw sampled-frame signal; it is not automatically speech or a burned-in caption.'
    };
  });
}

async function runOcr(frames, packageDirectory, width, height) {
  const versionResult = await runCommand('tesseract', ['--version'], { allowFailure: true });
  const extractorVersion = versionResult.code === 0
    ? versionResult.stdout.split(/\r?\n/, 1)[0].trim()
    : 'version_unavailable';
  const observations = [];
  for (const frame of frames) {
    const result = await runCommand('tesseract', [join(packageDirectory, frame.relative_path), 'stdout', '--psm', '11', 'tsv'], { allowFailure: true });
    if (result.code !== 0) continue;
    observations.push(...parseTsv(result.stdout, frame, width, height, observations.length, extractorVersion));
  }
  return observations;
}

async function extractPcmAudio(sourcePath, outputPath) {
  await runCommand('ffmpeg', ['-v', 'error', '-y', '-i', sourcePath, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath]);
}

function speechIntervalsFromSilence(stderr, durationSeconds) {
  const silences = [];
  let open = null;
  for (const line of stderr.split(/\r?\n/)) {
    const start = line.match(/silence_start:\s*([0-9.]+)/);
    if (start) open = Number(start[1]);
    const end = line.match(/silence_end:\s*([0-9.]+)/);
    if (end && open !== null) {
      silences.push({ start_seconds: open, end_seconds: Number(end[1]) });
      open = null;
    }
  }
  if (open !== null) silences.push({ start_seconds: open, end_seconds: durationSeconds });
  const intervals = [];
  let cursor = 0;
  for (const silence of silences) {
    if (silence.start_seconds - cursor >= 0.12) intervals.push({ start_seconds: cursor, end_seconds: silence.start_seconds });
    cursor = Math.max(cursor, silence.end_seconds);
  }
  if (durationSeconds - cursor >= 0.12) intervals.push({ start_seconds: cursor, end_seconds: durationSeconds });
  return intervals.length ? intervals : [{ start_seconds: 0, end_seconds: durationSeconds }];
}

async function runAsr(sourcePath, stagingDirectory, durationSeconds, asrPython) {
  const wavPath = join(stagingDirectory, 'audio-16khz-mono.wav');
  await extractPcmAudio(sourcePath, wavPath);
  const silence = await runCommand('ffmpeg', ['-hide_banner', '-i', wavPath, '-af', 'silencedetect=noise=-35dB:d=0.4', '-f', 'null', '-'], { allowFailure: true, maxOutputBytes: 8_000_000 });
  const intervals = speechIntervalsFromSilence(silence.stderr, durationSeconds);
  const result = await runCommand(asrPython, [resolve(moduleDirectory, 'asr-pocketsphinx.py'), wavPath, '--intervals-json', JSON.stringify(intervals)], { allowFailure: true, maxOutputBytes: 16_000_000 });
  if (result.code !== 0) throw new IntakeError('ASR_FAILED', 'The configured ASR extractor failed.', { stderr: result.stderr.slice(-4000), extractor: 'PocketSphinx' });
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { throw new IntakeError('ASR_INVALID_OUTPUT', 'The ASR extractor returned invalid JSON.'); }
  return { ...parsed, speech_intervals: intervals, audio_derivative: { relative_path: 'audio-16khz-mono.wav', retained_in_local_package: true } };
}

async function extractMotionEvidence(sourcePath, intervalSeconds, expectedFrames) {
  const result = await runCommandBuffer('ffmpeg', [
    '-hide_banner', '-i', sourcePath, '-vf', `fps=1/${intervalSeconds},scale=64:64,format=gray,showinfo`, '-an', '-f', 'rawvideo', 'pipe:1'
  ]);
  const timestamps = [...result.stderr.matchAll(/pts_time:([0-9.]+)/g)].map(match => Number(match[1]));
  const frameSize = 64 * 64;
  const count = Math.floor(result.stdout.length / frameSize);
  if (count !== timestamps.length || count !== expectedFrames.length) {
    throw new IntakeError('VISUAL_EVIDENCE_INTEGRITY_FAILED', 'Motion frames, timestamps, and sampled evidence frames did not bind one-to-one.', {
      motion_frames: count, timestamps: timestamps.length, evidence_frames: expectedFrames.length
    });
  }
  const rawFrames = Array.from({ length: count }, (_, index) => result.stdout.subarray(index * frameSize, (index + 1) * frameSize));
  return { rawFrames, timestamps };
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

function makeEvidence({ frames, rawOcr, changes, visualObservations, hasAudio, asr, asrState }) {
  const speechSpans = asr?.spans || [];
  const classified = classifyOcr(rawOcr, speechSpans);
  const speakerTurns = buildSpeakerTurns(speechSpans);
  const lanes = {
    spoken_audio: {
      state: !hasAudio ? 'not_present' : asrState,
      verification_modality: !hasAudio ? 'ffprobe_no_audio_stream' : 'automatic_speech_recognition',
      extractor: asr?.extractor || null,
      observations: speechSpans,
      uncertainty: !hasAudio ? null : asrState === 'completed'
        ? 'Automatic PocketSphinx output with word timestamps/confidence; not direct human/model audio audition.'
        : 'Audio exists, but a transcript was not recovered.'
    },
    speaker_turns: {
      state: !hasAudio ? 'not_present' : speakerTurns.length ? 'turn_boundaries_only' : 'not_recovered',
      verification_modality: speakerTurns.length ? 'silence_bounded_asr_utterances' : null,
      observations: speakerTurns,
      uncertainty: hasAudio ? 'Turn boundaries are bounded by silence; speaker clustering and identity are not implemented.' : null
    },
    burned_in_captions: {
      state: classified.burnedInCaptions.length ? 'heuristically_classified' : 'none_observed_at_sampling_cadence',
      verification_modality: 'tesseract_tsv_plus_layout_and_temporal_asr_overlap',
      observations: classified.burnedInCaptions,
      uncertainty: 'Caption classification is heuristic and sampling can miss transient text.'
    },
    other_on_screen_text: {
      state: 'completed_at_sampling_cadence',
      verification_modality: 'tesseract_tsv_on_sampled_frames',
      observations: classified.otherText,
      raw_observations: rawOcr,
      uncertainty: 'OCR remains sampled evidence; it is not spoken dialogue reconstruction.'
    },
    visible_actions_subjects_ui_state: {
      state: 'bounded_screen_state_classifier',
      verification_modality: 'sampled_64x64_visual_change_plus_ocr_heuristic',
      observations: visualObservations,
      uncertainty: 'Screen-state/activity candidates are sampled and heuristic; subject/object recognition remains unrecovered.'
    },
    visual_shot_state_changes: {
      state: changes.state,
      verification_modality: 'ffmpeg_scene_score',
      observations: changes.observations.map((observation, index) => ({ ...observation, observation_id: `scene-${String(index + 1).padStart(6, '0')}` })),
      uncertainty: 'Scene-score candidates are not semantic descriptions of the change.'
    }
  };
  const synchronizedTimeline = buildSynchronizedTimeline(lanes, classified.conflicts);
  const evidence = {
    schema_version: PACKAGE_SCHEMA_VERSION,
    representation: 'synchronized_multimodal_evidence',
    sampling_disclosure: 'Visual and OCR evidence is sampled, not frame-exhaustive.',
    lanes,
    modality_conflicts: classified.conflicts,
    synchronized_timeline: synchronizedTimeline
  };
  validateSynchronizedTimeline(evidence);
  return evidence;
}

export function evaluateSafeDeletion({ manifest, evidence, readback }) {
  const laneStates = Object.fromEntries(REQUIRED_LANES.map(name => [name, evidence?.lanes?.[name]?.state || 'missing']));
  const allowedCompleteStates = new Set(['completed', 'not_present']);
  const requiredEvidenceComplete = Object.values(laneStates).every(state => allowedCompleteStates.has(state));
  const checks = {
    required_evidence_extraction_completed: requiredEvidenceComplete,
    local_evidence_package_written: manifest?.persistence?.local?.write_state === 'written',
    local_evidence_package_read_back_verified: readback?.verified === true && manifest?.persistence?.local?.readback_state === 'verified',
    remote_durable_evidence_package_written: manifest?.persistence?.remote?.write_state === 'written',
    remote_evidence_package_read_back_verified: manifest?.persistence?.remote?.readback_state === 'verified',
    remote_package_resolvable_by_authorized_future_session: manifest?.persistence?.remote?.access_state === 'authorized_retrieval_verified',
    manifest_records_source_retention_state: Boolean(manifest?.raw_source?.retention_state)
  };
  return {
    safe_to_delete_original: Object.values(checks).every(Boolean),
    checks,
    lane_states: laneStates,
    reason: !requiredEvidenceComplete
      ? 'One or more required evidence lanes are incomplete, bounded-only, heuristic, or missing.'
      : !checks.remote_evidence_package_read_back_verified || !checks.remote_package_resolvable_by_authorized_future_session
        ? 'The package is locally verified but not remotely durable and re-readable by a future authorized session.'
        : null
  };
}

function validatePackageShape(manifest, evidence) {
  const missing = [];
  for (const field of ['package_id', 'source', 'content_sha256', 'duration_seconds', 'processing', 'coverage', 'persistence', 'raw_source']) {
    if (manifest?.[field] === undefined || manifest?.[field] === null) missing.push(`manifest.${field}`);
  }
  for (const path of [
    ['media_asset', 'media_asset_id'],
    ['media_asset', 'content_version_sha256'],
    ['evidence_package', 'identity'],
    ['persistence', 'evidence_sha256'],
    ['persistence', 'local'],
    ['persistence', 'remote']
  ]) {
    let value = manifest;
    for (const segment of path) value = value?.[segment];
    if (value === undefined || value === null) missing.push(`manifest.${path.join('.')}`);
  }
  for (const lane of REQUIRED_LANES) if (!evidence?.lanes?.[lane]) missing.push(`evidence.lanes.${lane}`);
  if (!Array.isArray(evidence?.synchronized_timeline)) missing.push('evidence.synchronized_timeline');
  if (missing.length) throw new IntakeError('EVIDENCE_PACKAGE_INCOMPLETE', 'The evidence package is missing required components.', { missing });
  try {
    validateSynchronizedTimeline(evidence);
  } catch (error) {
    throw new IntakeError('SYNCHRONIZED_TIMELINE_INVALID', 'The synchronized timeline failed structural/provenance validation.', { cause: error.message });
  }
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

async function persistAndVerifyRemote(remoteStore, packageDirectory, packageId, expectedEvidenceSha256) {
  if (!remoteStore) return {
    provider: null,
    write_state: 'not_configured',
    readback_state: 'not_run',
    access_state: 'local_only',
    locator: null
  };
  if (typeof remoteStore.persistPackage !== 'function' || typeof remoteStore.readEvidence !== 'function') {
    throw new IntakeError('REMOTE_PERSISTENCE_INVALID', 'Remote store must implement persistPackage() and readEvidence().');
  }
  const receipt = await remoteStore.persistPackage({ packageDirectory, packageId, expectedEvidenceSha256 });
  if (!receipt?.locator) throw new IntakeError('REMOTE_PERSISTENCE_FAILED', 'Remote persistence returned no stable locator.');
  let remoteEvidence;
  try { remoteEvidence = await remoteStore.readEvidence(receipt); } catch (error) {
    throw new IntakeError('REMOTE_PERSISTENCE_READBACK_FAILED', 'Remote evidence could not be read back.', { cause: error.message, locator: receipt.locator });
  }
  const text = typeof remoteEvidence === 'string' ? remoteEvidence : Buffer.from(remoteEvidence).toString('utf8');
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) {
    throw new IntakeError('REMOTE_PERSISTENCE_READBACK_FAILED', 'Remote evidence read-back was not valid JSON.', { cause: error.message, locator: receipt.locator });
  }
  const normalized = JSON.stringify(parsed, null, 2) + '\n';
  const digest = await sha256Text(normalized);
  if (digest !== expectedEvidenceSha256) {
    throw new IntakeError('REMOTE_PERSISTENCE_READBACK_FAILED', 'Remote evidence digest did not match the locally verified package.', {
      expected: expectedEvidenceSha256, actual: digest, locator: receipt.locator
    });
  }
  return {
    provider: remoteStore.provider || 'custom',
    write_state: 'written',
    readback_state: 'verified',
    access_state: 'authorized_retrieval_verified',
    locator: receipt.locator,
    evidence_sha256: digest,
    verified_at: now()
  };
}

export async function processVideo(input, {
  outputRoot = '.video-analysis',
  frameIntervalSeconds = 5,
  fetchImpl = fetch,
  beforeReadback = null,
  asrPython = resolve(moduleDirectory, '../../.video-analysis-runtime/venv/bin/python'),
  remoteStore = null
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
    const width = probe.video_streams[0].width;
    const height = probe.video_streams[0].height;
    const rawOcr = await runOcr(frames, stagingDirectory, width, height);
    let asr = null;
    let asrState = probe.audio_streams.length ? 'extractor_unavailable' : 'not_present';
    let asrFailure = null;
    if (probe.audio_streams.length && await exists(asrPython)) {
      try {
        asr = await runAsr(resolved.path, stagingDirectory, probe.duration_seconds, asrPython);
        asrState = asr.spans.length ? 'completed' : 'no_speech_recovered';
      } catch (error) {
        asrState = 'extractor_failed';
        asrFailure = { code: error.code || 'ASR_FAILED', message: error.message };
      }
    }
    const changes = await detectVisualChanges(resolved.path);
    const motion = await extractMotionEvidence(resolved.path, frameIntervalSeconds, frames);
    const visualObservations = buildSemanticVisualObservations(motion.rawFrames, motion.timestamps, rawOcr);
    const evidence = makeEvidence({
      frames, rawOcr, changes, visualObservations, hasAudio: probe.audio_streams.length > 0, asr, asrState
    });
    if (asrFailure) evidence.lanes.spoken_audio.failure = asrFailure;
    const evidenceText = JSON.stringify(evidence, null, 2) + '\n';
    const manifest = {
      schema_version: PACKAGE_SCHEMA_VERSION,
      package_id: packageId,
      source: resolved.source,
      content_sha256: contentSha256,
      media_asset: {
        media_asset_id: `mediaasset-sha256-${contentSha256}`,
        identity_method: 'content_addressed_source_bytes_v1',
        content_version_sha256: contentSha256,
        asset_locations: [{
          location_type: resolved.source.type,
          state: 'available_during_processing',
          original_filename: resolved.source.original_filename,
          source_url: resolved.source.source_url
        }]
      },
      duration_seconds: probe.duration_seconds,
      media_probe: probe,
      processing: {
        state: 'synchronized_evidence_foundation_extracted',
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
        transcript: evidence.lanes.spoken_audio.state,
        speaker_turns: evidence.lanes.speaker_turns.state,
        ocr_classification: evidence.lanes.burned_in_captions.state,
        semantic_visual_evidence: evidence.lanes.visible_actions_subjects_ui_state.state,
        synchronized_timeline: 'structurally_validated'
      },
      evidence_package: {
        identity: packageId,
        relative_manifest_path: 'manifest.json',
        relative_evidence_path: 'evidence.json'
      },
      persistence: {
        evidence_sha256: await sha256Text(evidenceText),
        local: {
          scope: 'current_machine_or_workspace',
          write_state: 'written',
          readback_state: 'pending',
          package_location: finalDirectory
        },
        remote: {
          provider: null,
          write_state: 'not_configured',
          readback_state: 'not_run',
          access_state: 'local_only',
          locator: null
        }
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
    readback.manifest.persistence.local.readback_state = 'verified';
    readback.manifest.persistence.local.readback_verified_at = readback.verified_at;
    readback.manifest.persistence.remote = await persistAndVerifyRemote(
      remoteStore, finalDirectory, packageId, readback.manifest.persistence.evidence_sha256
    );
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
