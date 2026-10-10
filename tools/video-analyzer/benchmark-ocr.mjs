#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { processVideo, runCommand, sha256File } from './core.mjs';

function valueAfter(args, flag, fallback = null) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

const args = process.argv.slice(2);
const input = valueAfter(args, '--input');
const outputRoot = valueAfter(args, '--output-root');
const receiptPath = valueAfter(args, '--receipt');
const intervalSeconds = Number(valueAfter(args, '--interval', '5'));
const fixtureId = valueAfter(args, '--fixture-id', 'unlabeled');
const memoization = valueAfter(args, '--memoization', 'none');
if (!input || !outputRoot || !receiptPath || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
  console.error('Usage: benchmark-ocr.mjs --input VIDEO --output-root DIR --receipt FILE --interval SECONDS --fixture-id ID');
  process.exit(2);
}

const resolvedInput = resolve(input);
const toolVersions = {};
for (const [name, command, commandArgs] of [
  ['ffmpeg', 'ffmpeg', ['-version']],
  ['ffprobe', 'ffprobe', ['-version']],
  ['tesseract', 'tesseract', ['--version']]
]) {
  const result = await runCommand(command, commandArgs, { allowFailure: true });
  toolVersions[name] = (result.stdout || result.stderr).split(/\r?\n/, 1)[0].trim();
}

const performanceEvents = [];
const started = performance.now();
const result = await processVideo(resolvedInput, {
  outputRoot: resolve(outputRoot),
  frameIntervalSeconds: intervalSeconds,
  ocrMemoization: memoization,
  performanceObserver: event => performanceEvents.push(event)
});
const analyzerWallMs = Number((performance.now() - started).toFixed(3));
const resourceUsage = process.resourceUsage();
const frameInvocations = performanceEvents.filter(event => event.stage === 'ocr_frame');
const ocrSummary = performanceEvents.find(event => event.stage === 'ocr_summary');
const versionProbe = performanceEvents.find(event => event.stage === 'ocr_version_probe');
const latencies = frameInvocations.map(event => event.elapsed_ms).sort((a, b) => a - b);
const percentile = fraction => latencies.length
  ? latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * fraction))]
  : null;
const rawOcr = result.evidence.lanes.other_on_screen_text.raw_observations || [];
const selectedEvents = result.evidence.lanes.visible_actions_subjects_ui_state.selection?.receipts || [];
const receipt = {
  schema_version: 'video-analyzer-ocr-benchmark-run.v1',
  fixture_id: fixtureId,
  input: {
    path: resolvedInput,
    sha256: await sha256File(resolvedInput),
    duration_seconds: result.manifest.duration_seconds,
    has_audio: result.manifest.media_probe.audio_streams.length > 0
  },
  analyzer: {
    commit_expected_from_caller: true,
    frame_interval_seconds: intervalSeconds,
    sampled_frame_count: result.manifest.coverage.visual_sampling.frame_count,
    selected_visual_event_count: selectedEvents.length,
    ocr_observation_count: rawOcr.length,
    wall_ms: analyzerWallMs,
    package_id: result.manifest.package_id,
    package_readback_verified: result.readback.verified
  },
  ocr: {
    scheduling: ocrSummary.scheduling,
    memoization: ocrSummary.memoization,
    version_probe_count: versionProbe ? 1 : 0,
    version_probe_elapsed_ms: versionProbe?.elapsed_ms ?? null,
    frame_occurrence_count: frameInvocations.length,
    tesseract_invocation_count: ocrSummary.tesseract_invocation_count,
    cache_hit_count: ocrSummary.cache_hit_count,
    cache_miss_count: ocrSummary.cache_miss_count,
    total_stage_elapsed_ms: ocrSummary.elapsed_ms,
    summed_frame_invocation_elapsed_ms: Number(frameInvocations.reduce((sum, event) => sum + event.elapsed_ms, 0).toFixed(3)),
    latency_ms: {
      min: latencies[0] ?? null,
      median: percentile(0.5),
      p95: percentile(0.95),
      max: latencies.at(-1) ?? null
    },
    invocations: frameInvocations
  },
  process_resource_usage: {
    max_rss_kib_reported_by_node: resourceUsage.maxRSS,
    user_cpu_time_us: resourceUsage.userCPUTime,
    system_cpu_time_us: resourceUsage.systemCPUTime
  },
  tool_versions: {
    node: process.version,
    ...toolVersions
  },
  uncertainty: [
    'Wall and per-invocation timings are single-run observations and include normal local process and filesystem variance.',
    'Node maxRSS is process-lifetime maximum resident set size reported in KiB; /usr/bin/time and system memory-pressure receipts are recorded separately.',
    'Selected-event count is known only after OCR and visual analysis; it describes potential redundant work but does not by itself define a safe future schedule.'
  ]
};

await mkdir(dirname(resolve(receiptPath)), { recursive: true });
await writeFile(resolve(receiptPath), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
