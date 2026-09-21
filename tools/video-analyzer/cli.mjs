#!/usr/bin/env node
import { processVideo, IntakeError } from './core.mjs';

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--'));
const outputFlag = args.findIndex(arg => arg === '--output');
const intervalFlag = args.findIndex(arg => arg === '--frame-interval');
if (!input) {
  console.error('Usage: npm run video:ingest -- <file-or-direct-video-url> [--output <directory>] [--frame-interval <seconds>]');
  process.exit(2);
}

try {
  const result = await processVideo(input, {
    outputRoot: outputFlag >= 0 ? args[outputFlag + 1] : '.video-analysis',
    frameIntervalSeconds: intervalFlag >= 0 ? Number(args[intervalFlag + 1]) : 5
  });
  console.log(JSON.stringify({
    package_directory: result.package_directory,
    package_id: result.manifest.package_id,
    source_type: result.manifest.source.type,
    content_sha256: result.manifest.content_sha256,
    duration_seconds: result.manifest.duration_seconds,
    decode_coverage: result.manifest.coverage.state,
    local_persistence_readback: result.manifest.persistence.local.readback_state,
    remote_persistence_readback: result.manifest.persistence.remote.readback_state,
    safe_to_delete_original: result.manifest.safe_deletion_gate.safe_to_delete_original,
    safe_deletion_reason: result.manifest.safe_deletion_gate.reason
  }, null, 2));
} catch (error) {
  const body = error instanceof IntakeError
    ? { error: error.code, message: error.message, details: error.details }
    : { error: 'UNEXPECTED_ERROR', message: error?.message || String(error) };
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}
