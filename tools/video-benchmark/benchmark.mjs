#!/usr/bin/env node
/**
 * Bounded local benchmark harness. It deliberately does not download models,
 * inspect remote media, create cloud resources, or remotely control a Mac.
 */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, platform, release, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', TARGET_REQUIRED: 'UNTESTED — TARGET HARDWARE EXECUTION REQUIRED', BLOCKED: 'BLOCKED' };
const GOLD_STATUS = new Set(['complete', 'incomplete', 'not_applicable']);
const IDENTITY_OUTCOME = {
  EXACT: 'EXACT_REPRESENTATION_MATCH',
  DRIFT: 'LOGICAL_SOURCE_CONTINUITY_WITH_REPRESENTATION_DRIFT',
  UNRESOLVED: 'SOURCE_IDENTITY_UNRESOLVED',
  WRONG: 'WRONG_SOURCE'
};
const args = () => ({ get(name) { const i = process.argv.slice(3).indexOf(name); return i < 0 ? null : process.argv.slice(3)[i + 1]; } });
function commandVersion(command, flags = ['--version']) {
  const r = spawnSync(command, flags, { encoding: 'utf8' });
  return r.error || r.status !== 0 ? null : (r.stdout || r.stderr).trim().split(/\r?\n/, 1)[0] || null;
}
function systemValue(command, flags) {
  const r = spawnSync(command, flags, { encoding: 'utf8' });
  return r.error || r.status !== 0 ? null : (r.stdout || '').trim() || null;
}
function targetCheck() {
  const macosVersion = platform() === 'darwin' ? systemValue('sw_vers', ['-productVersion']) : null;
  const chip = platform() === 'darwin' ? systemValue('sysctl', ['-n', 'machdep.cpu.brand_string']) : null;
  const hardwareModel = platform() === 'darwin' ? systemValue('sysctl', ['-n', 'hw.model']) : null;
  const memoryGb = Number((totalmem() / 1024 ** 3).toFixed(2));
  const isAppleSiliconMac = platform() === 'darwin' && arch() === 'arm64';
  const isExactTarget = isAppleSiliconMac && /Apple M4 Pro/i.test(chip || '') && memoryGb >= 24 && macosVersion === '26.6.2';
  return {
    required_target: { model: 'MacBook Pro 14-inch (November 2024)', chip: 'Apple M4 Pro', unified_memory_gb_minimum: 24, macos: 'Tahoe 26.6.2' },
    observed_environment: { platform: platform(), architecture: arch(), kernel: release(), total_memory_gb: memoryGb, macos_version: macosVersion, hardware_model: hardwareModel, chip, node: process.version, ffmpeg: commandVersion('ffmpeg', ['-version']), ffprobe: commandVersion('ffprobe', ['-version']), python3: commandVersion('python3'), uv: commandVersion('uv') },
    is_target_hardware_class: isAppleSiliconMac, is_exact_target: isExactTarget
  };
}
async function receipt(path, body) { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, JSON.stringify(body, null, 2) + '\n'); console.log(JSON.stringify(body, null, 2)); }
async function preflight(output) {
  const check = targetCheck();
  const missing = ['ffmpeg', 'ffprobe', 'python3'].filter(name => !check.observed_environment[name]);
  await receipt(output, { schema_version: 'apple-silicon-video-benchmark-receipt-1.0', receipt_type: 'machine_preflight', created_at: new Date().toISOString(), applicability: 'target_macbook_only', operational_result: !check.is_exact_target ? STATUS.TARGET_REQUIRED : missing.length ? STATUS.BLOCKED : STATUS.PASS, quality_result: 'NOT_APPLICABLE', environment: check.observed_environment, target: check.required_target, prerequisites_missing: missing, notes: !check.is_exact_target ? "This runner is not Ashley's specified M4 Pro / 24 GB / macOS 26.6.2 target. No target-hardware component result is implied." : missing.length ? 'Install listed prerequisites before resolving a component environment.' : 'Basic machine preflight only; this is not a component quality result.' });
}
async function sha256(path) { return createHash('sha256').update(await readFile(path)).digest('hex'); }
function frozenRepresentation(source) {
  const frozen = source.frozen_representation;
  if (!frozen || frozen.sha256 !== source.sha256 || frozen.duration_seconds !== source.duration_seconds) throw new Error(`Frozen representation metadata must exactly preserve legacy SHA-256/duration for ${source.id}.`);
  return frozen;
}
function continuityEvidenceIsSufficient(observation, source) {
  const evidence = observation.logical_continuity?.evidence;
  if (observation.observed_logical_source_id !== source.logical_source?.id || !Array.isArray(evidence)) return false;
  const types = new Set(evidence.map(item => item?.type));
  return types.has('platform_post_id_observed') && types.has('historical_representation_provenance') && !types.has('source_url_only');
}
function validateIdentityRegistry(corpus) {
  for (const source of corpus.sources || []) {
    if (!source.logical_source?.platform || !source.logical_source?.kind || !source.logical_source?.id) throw new Error(`Missing logical_source identity for ${source.id}.`);
    const frozen = frozenRepresentation(source);
    if (!/^[a-f0-9]{64}$/i.test(frozen.sha256 || '')) throw new Error(`Invalid frozen SHA-256 for ${source.id}.`);
    for (const observation of source.observed_representations || []) {
      if (!/^[a-f0-9]{64}$/i.test(observation.sha256 || '')) throw new Error(`Invalid observed SHA-256 for ${source.id}.`);
      if (observation.identity_outcome === IDENTITY_OUTCOME.DRIFT) {
        if (observation.sha256 === frozen.sha256) throw new Error(`${source.id} cannot call identical bytes representation drift.`);
        if (!continuityEvidenceIsSufficient(observation, source)) throw new Error(`${source.id} representation drift lacks independent logical-continuity provenance.`);
      }
      if (observation.identity_outcome === IDENTITY_OUTCOME.WRONG && observation.observed_logical_source_id === source.logical_source.id) throw new Error(`${source.id} cannot classify the same logical source as WRONG_SOURCE.`);
    }
  }
}
function classifyRepresentation(source, actualSha256) {
  const frozen = frozenRepresentation(source);
  if (actualSha256 === frozen.sha256) return { identity_outcome: IDENTITY_OUTCOME.EXACT, exact_representation_match: true, logical_source_continuity: 'ESTABLISHED', evidence_scope: 'SHA-256 exact frozen representation match' };
  const observation = (source.observed_representations || []).find(item => item.sha256 === actualSha256);
  if (!observation) return { identity_outcome: IDENTITY_OUTCOME.UNRESOLVED, exact_representation_match: false, logical_source_continuity: 'UNRESOLVED', failure_reason: 'SHA-256 differs from frozen representation and no independently evidenced observed representation matches these bytes. URL, duration, platform, audio similarity, and yt-dlp success are insufficient.' };
  if (observation.identity_outcome === IDENTITY_OUTCOME.DRIFT && continuityEvidenceIsSufficient(observation, source)) return { identity_outcome: IDENTITY_OUTCOME.DRIFT, exact_representation_match: false, logical_source_continuity: 'ESTABLISHED', observed_representation_id: observation.representation_id, evidence_scope: 'Recorded independent logical-source continuity evidence; exact representation remains different.' };
  if (observation.identity_outcome === IDENTITY_OUTCOME.WRONG) return { identity_outcome: IDENTITY_OUTCOME.WRONG, exact_representation_match: false, logical_source_continuity: 'FAILED', observed_representation_id: observation.representation_id, failure_reason: 'Recorded provenance identifies these bytes as a different logical source.' };
  return { identity_outcome: IDENTITY_OUTCOME.UNRESOLVED, exact_representation_match: false, logical_source_continuity: 'UNRESOLVED', failure_reason: 'Observed representation lacks sufficient independent continuity evidence.' };
}
async function verifyCorpus(corpusPath, mediaRoot, output) {
  const corpus = JSON.parse(await readFile(corpusPath, 'utf8')), results = [];
  validateIdentityRegistry(corpus);
  for (const source of corpus.sources || []) {
    const frozen = frozenRepresentation(source);
    try {
      const actual = await sha256(join(mediaRoot, source.local_filename)), identity = classifyRepresentation(source, actual);
      results.push({ source_id: source.id, logical_source: source.logical_source, local_filename: source.local_filename, frozen_representation_sha256: frozen.sha256, actual_sha256: actual, identity_verification_outcome: identity.identity_outcome, exact_representation_match: identity.exact_representation_match, logical_source_continuity: identity.logical_source_continuity, operational_result: identity.identity_outcome === IDENTITY_OUTCOME.UNRESOLVED || identity.identity_outcome === IDENTITY_OUTCOME.WRONG ? STATUS.FAIL : STATUS.PASS, quality_result: 'NOT_APPLICABLE', ...identity });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      results.push({ source_id: source.id, logical_source: source.logical_source, local_filename: source.local_filename, frozen_representation_sha256: frozen.sha256, identity_verification_outcome: 'SOURCE_BYTES_NOT_PRESENT', operational_result: STATUS.BLOCKED, quality_result: 'NOT_APPLICABLE', failure_reason: 'Source bytes are not present under VIDEO_BENCHMARK_MEDIA_ROOT. The registry is identity metadata, not Git video storage.' });
    }
  }
  const allExact = results.length > 0 && results.every(result => result.identity_verification_outcome === IDENTITY_OUTCOME.EXACT);
  await receipt(output, { schema_version: 'apple-silicon-video-benchmark-receipt-1.1', receipt_type: 'corpus_identity_verification', created_at: new Date().toISOString(), corpus: { path: corpusPath, registry_version: corpus.schema_version, source_count: results.length }, exact_representation_gate: allExact ? STATUS.PASS : 'NOT PASS — one or more source identities are blocked, unresolved, wrong, or documented representation drift', results });
}
function validateSpan(span, path) {
  if (!Number.isFinite(span?.start_seconds) || !Number.isFinite(span?.end_seconds) || span.start_seconds < 0 || span.end_seconds < span.start_seconds) throw new Error(`${path} needs a non-negative [start_seconds, end_seconds] range.`);
  if (span.state !== 'observable' && span.state !== 'inaudible_or_obscured' && span.state !== 'uncertain') throw new Error(`${path}.state must preserve observable, inaudible_or_obscured, or uncertain.`);
}
function validateGoldLane(lane, path) {
  if (!lane || !GOLD_STATUS.has(lane.status)) throw new Error(`${path}.status must be complete, incomplete, or not_applicable.`);
  if (lane.status === 'complete' && (!Array.isArray(lane.spans) || !lane.spans.length)) throw new Error(`${path} cannot be complete without human-verified spans.`);
  for (const [index, span] of (lane.spans || []).entries()) validateSpan(span, `${path}.spans[${index}]`);
}
async function validateGold(goldPath, corpusPath, output) {
  const [gold, corpus] = await Promise.all([readFile(goldPath, 'utf8').then(JSON.parse), readFile(corpusPath, 'utf8').then(JSON.parse)]);
  if (gold.schema_version !== 'ashley-video-human-gold-1.0') throw new Error('Unsupported human-gold schema_version.');
  const expected = new Map((corpus.sources || []).map(source => [source.id, source]));
  if (!Array.isArray(gold.sources) || gold.sources.length !== expected.size) throw new Error('Human-gold file must contain exactly one entry for every frozen corpus source.');
  const requiredLanes = ['spoken_text', 'speaker_turns', 'burned_in_caption', 'other_on_screen_text', 'scene_edit', 'semantic_visual'];
  const results = [];
  for (const source of gold.sources) {
    const registered = expected.get(source.source_id);
    if (!registered) throw new Error(`Unknown human-gold source_id: ${source.source_id}.`);
    if (source.source_sha256 !== registered.sha256) throw new Error(`Human-gold SHA-256 does not match frozen corpus identity for ${source.source_id}.`);
    if (!source.review || !['complete_source_direct_human_review', 'incomplete_or_not_started'].includes(source.review.coverage_state)) throw new Error(`${source.source_id}.review.coverage_state is invalid.`);
    for (const lane of requiredLanes) validateGoldLane(source.lanes?.[lane], `${source.source_id}.lanes.${lane}`);
    const laneStates = requiredLanes.map(lane => source.lanes[lane].status);
    const allLanesResolved = laneStates.every(status => status === 'complete' || status === 'not_applicable');
    if (source.gold_completion_state === 'complete' && (source.review.coverage_state !== 'complete_source_direct_human_review' || !allLanesResolved)) throw new Error(`${source.source_id} cannot claim complete gold without complete direct review and resolved lanes.`);
    const candidateLaneRequirements = {
      speech: ['spoken_text'], speaker_change_candidate: ['speaker_turns'], burned_in_caption: ['burned_in_caption'],
      other_on_screen_text: ['other_on_screen_text'], outdoor_text_or_signage_candidate: ['other_on_screen_text'],
      edited_shots: ['scene_edit', 'semantic_visual']
    };
    if (source.gold_completion_state === 'complete') for (const modality of registered.candidate_modalities || []) for (const lane of candidateLaneRequirements[modality] || []) if (source.lanes[lane].status !== 'complete') throw new Error(`${source.source_id} cannot claim complete gold while candidate modality ${modality} lacks complete ${lane} evidence.`);
    if (!['complete', 'incomplete'].includes(source.gold_completion_state)) throw new Error(`${source.source_id}.gold_completion_state must be complete or incomplete.`);
    results.push({ source_id: source.source_id, source_sha256: source.source_sha256, gold_completion_state: source.gold_completion_state, coverage_state: source.review.coverage_state, lane_statuses: Object.fromEntries(requiredLanes.map(lane => [lane, source.lanes[lane].status])) });
  }
  await receipt(output, { schema_version: 'apple-silicon-video-benchmark-receipt-1.0', receipt_type: 'human_gold_validation', created_at: new Date().toISOString(), applicability: 'calibration_evidence_schema_only', operational_result: STATUS.PASS, quality_result: 'NOT_APPLICABLE', gold_path: goldPath, corpus_path: corpusPath, results, notes: 'This validates evidence structure and frozen-source binding only. It does not establish that a human actually reviewed the source or that any component meets quality criteria.' });
}
const command = process.argv[2], { get } = args();
if (command === 'preflight') await preflight(get('--output') || 'artifacts/video-benchmark/machine-preflight.json');
else if (command === 'verify-corpus') { const corpus = get('--corpus'); if (!corpus) throw new Error('verify-corpus requires --corpus <registry.json>.'); await verifyCorpus(corpus, get('--media-root') || process.env.VIDEO_BENCHMARK_MEDIA_ROOT || '.', get('--output') || 'artifacts/video-benchmark/corpus-identity.json'); }
else if (command === 'validate-gold') { const gold = get('--gold'), corpus = get('--corpus'); if (!gold || !corpus) throw new Error('validate-gold requires --gold <human-gold.json> --corpus <registry.json>.'); await validateGold(gold, corpus, get('--output') || 'artifacts/video-benchmark/human-gold-validation.json'); }
else { console.error('Usage: benchmark.mjs preflight [--output receipt.json] | verify-corpus --corpus registry.json [--media-root directory] [--output receipt.json] | validate-gold --gold human-gold.json --corpus registry.json [--output receipt.json]'); process.exit(2); }
