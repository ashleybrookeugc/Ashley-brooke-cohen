import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = resolve('tools/video-benchmark/benchmark.mjs');
const corpus = resolve('tools/video-benchmark/calibration-corpus.json');

function assertSupportedLiteralSourceUrl(value) {
  assert.equal(typeof value, 'string');
  assert.doesNotMatch(value, /\[[^\]]*\]\([^)]*\)/, 'source_url must not contain Markdown-link syntax');
  assert.doesNotMatch(value, /[\[\]]/, 'source_url must be a literal URL, not display text');
  const url = new URL(value);
  assert.ok(['www.tiktok.com', 'www.instagram.com'].includes(url.hostname), 'unsupported source host: ' + url.hostname);
  assert.ok(url.protocol === 'https:', 'source_url must use HTTPS');
}

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

test('calibration registry contains six supported literal source URLs, never Markdown links', async () => {
  const body = JSON.parse(await readFile(corpus, 'utf8'));
  assert.equal(body.sources.length, 6);
  for (const source of body.sources) assertSupportedLiteralSourceUrl(source.source_url);
});
