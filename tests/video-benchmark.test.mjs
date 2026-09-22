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
  assert.doesNotMatch(value, /^\[[^\]]+\]\(https:\/\/[^)]+\)$/, 'source_url must not contain Markdown-link syntax');
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

test('literal URL guard rejects the known-bad Markdown-link serialization', () => {
  assert.throws(
    () => assertSupportedLiteralSourceUrl('[https://www.tiktok.com/t/ZP83DVEWH/](https://www.tiktok.com/t/ZP83DVEWH/)'),
    /Markdown-link syntax/
  );
});

test('URL repair preserves each frozen corpus entry outside source_url', async () => {
  const body = JSON.parse(await readFile(corpus, 'utf8'));
  const protectedFields = body.sources.map(({ source_url, ...rest }) => rest);
  assert.deepEqual(protectedFields, [
    { id: 'ashley-social-01', local_filename: 'ashley-social-01.mp4', sha256: 'd812ae5ab34b95063fdf8d56d9e05d24c3acac23c98ec0f4a83e150a80faab15', duration_seconds: 27.466667, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'edited_shots'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-02', local_filename: 'ashley-social-02.mp4', sha256: 'd8a3587aa2e32c0fd8d0b7a4271544b21768a42b3325d75fa67321255de27ab9', duration_seconds: 32.166667, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'other_on_screen_text', 'edited_shots'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-04', local_filename: 'ashley-social-04.mp4', sha256: '7336ec9715c52021ff14fa40403a0f86291b60be2f2f1f44472e5c9ad163092f', duration_seconds: 15.135593, source_type: 'finished_social', candidate_modalities: ['speech', 'speaker_change_candidate', 'burned_in_caption'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-05', local_filename: 'ashley-social-05.mp4', sha256: '4549c6e9880e13d2a9f54d34092349cc5deb422755a2f4a8686e73c80b81dd9f', duration_seconds: 94.363039, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'other_on_screen_text', 'edited_shots'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-08', local_filename: 'ashley-social-08.mp4', sha256: 'b06c101bcf7b5a69699ebc7abd2f5c8e8ef9161910fd715cd24db1253772c28e', duration_seconds: 15.566667, source_type: 'finished_social', candidate_modalities: ['speech', 'outdoor_text_or_signage_candidate'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-10', local_filename: 'ashley-social-10.mp4', sha256: '32bb074d859df59e091a23a141bc67ec32f8afd3c2f9c70e5988ed0aa0092e62', duration_seconds: 10.819002, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'other_on_screen_text', 'outdoor_text_or_signage_candidate'], gold_evidence_state: 'incomplete' }
  ]);
});
