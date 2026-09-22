import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = resolve('tools/video-benchmark/benchmark.mjs');
const corpus = resolve('tools/video-benchmark/calibration-corpus.json');

test('preflight does not misrepresent non-target hardware', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-')), output = join(root, 'preflight.json');
  assert.equal(spawnSync(process.execPath, [runner, 'preflight', '--output', output], { encoding: 'utf8' }).status, 0);
  const body = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(body.receipt_type, 'machine_preflight');
  assert.match(body.environment.ffmpeg, /^ffmpeg version /);
  assert.match(body.environment.ffprobe, /^ffprobe version /);
  if (process.platform !== 'darwin' || process.arch !== 'arm64') assert.equal(body.operational_result, 'UNTESTED — TARGET HARDWARE EXECUTION REQUIRED');
});

test('corpus verifier blocks absent bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-')), output = join(root, 'corpus.json');
  assert.equal(spawnSync(process.execPath, [runner, 'verify-corpus', '--corpus', corpus, '--media-root', root, '--output', output], { encoding: 'utf8' }).status, 0);
  const body = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(body.results.length, 6);
  assert.ok(body.results.every(item => item.operational_result === 'BLOCKED'));
});
