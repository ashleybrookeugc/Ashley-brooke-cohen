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
async function verifyCorpus(corpusPath, mediaRoot, output) {
  const corpus = JSON.parse(await readFile(corpusPath, 'utf8')), results = [];
  for (const source of corpus.sources || []) {
    if (!/^[a-f0-9]{64}$/i.test(source.sha256 || '')) throw new Error(`Invalid SHA-256 for ${source.id}.`);
    try { const actual = await sha256(join(mediaRoot, source.local_filename)); results.push({ source_id: source.id, local_filename: source.local_filename, expected_sha256: source.sha256, actual_sha256: actual, operational_result: actual === source.sha256 ? STATUS.PASS : STATUS.FAIL, quality_result: 'NOT_APPLICABLE' }); }
    catch { results.push({ source_id: source.id, local_filename: source.local_filename, expected_sha256: source.sha256, operational_result: STATUS.BLOCKED, quality_result: 'NOT_APPLICABLE', failure_reason: 'Source bytes are not present under VIDEO_BENCHMARK_MEDIA_ROOT. The registry is identity metadata, not Git video storage.' }); }
  }
  await receipt(output, { schema_version: 'apple-silicon-video-benchmark-receipt-1.0', receipt_type: 'corpus_identity_verification', created_at: new Date().toISOString(), corpus: { path: corpusPath, registry_version: corpus.schema_version, source_count: results.length }, results });
}
const command = process.argv[2], { get } = args();
if (command === 'preflight') await preflight(get('--output') || 'artifacts/video-benchmark/machine-preflight.json');
else if (command === 'verify-corpus') { const corpus = get('--corpus'); if (!corpus) throw new Error('verify-corpus requires --corpus <registry.json>.'); await verifyCorpus(corpus, get('--media-root') || process.env.VIDEO_BENCHMARK_MEDIA_ROOT || '.', get('--output') || 'artifacts/video-benchmark/corpus-identity.json'); }
else { console.error('Usage: benchmark.mjs preflight [--output receipt.json] | verify-corpus --corpus registry.json [--media-root directory] [--output receipt.json]'); process.exit(2); }
