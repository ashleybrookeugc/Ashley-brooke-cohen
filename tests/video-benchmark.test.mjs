import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = resolve('tools/video-benchmark/benchmark.mjs');
const corpus = resolve('tools/video-benchmark/calibration-corpus.json');

const hash = value => createHash('sha256').update(value).digest('hex');
function identitySource({ frozenBytes = 'frozen', observed = [], logicalId = 'post-a' } = {}) {
  const frozenHash = hash(frozenBytes);
  return {
    id: 'source-a', local_filename: 'source-a.mp4', source_url: 'https://www.instagram.com/reel/post-a/',
    logical_source: { platform: 'instagram', kind: 'reel_post', id: logicalId },
    sha256: frozenHash, duration_seconds: 10,
    frozen_representation: { representation_id: `mediaasset-sha256-${frozenHash}`, sha256: frozenHash, duration_seconds: 10 },
    observed_representations: observed, source_type: 'finished_social', candidate_modalities: [], gold_evidence_state: 'incomplete'
  };
}
async function runIdentityFixture(root, source, bytes) {
  const registry = join(root, 'registry.json'), media = join(root, 'media'), output = join(root, 'identity.json');
  await (await import('node:fs/promises')).mkdir(media);
  await writeFile(registry, JSON.stringify({ schema_version: 'test', sources: [source] }));
  await writeFile(join(media, source.local_filename), bytes);
  const processResult = spawnSync(process.execPath, [runner, 'verify-corpus', '--corpus', registry, '--media-root', media, '--output', output], { encoding: 'utf8' });
  return { processResult, body: processResult.status === 0 ? JSON.parse(await readFile(output, 'utf8')) : null };
}

async function writeGoldFixture(root, mutate = value => value) {
  const registry = JSON.parse(await readFile(corpus, 'utf8'));
  const lanes = () => ({
    spoken_text: { status: 'not_applicable', spans: [] },
    speaker_turns: { status: 'not_applicable', spans: [] },
    burned_in_caption: { status: 'not_applicable', spans: [] },
    other_on_screen_text: { status: 'not_applicable', spans: [] },
    scene_edit: { status: 'not_applicable', spans: [] },
    semantic_visual: { status: 'not_applicable', spans: [] }
  });
  const body = mutate({
    schema_version: 'ashley-video-human-gold-1.0',
    sources: registry.sources.map(source => ({
      source_id: source.id,
      source_sha256: source.sha256,
      review: { coverage_state: 'incomplete_or_not_started' },
      gold_completion_state: 'incomplete',
      lanes: lanes(),
      modality_conflicts: []
    }))
  });
  const gold = join(root, 'human-gold.json');
  await (await import('node:fs/promises')).writeFile(gold, JSON.stringify(body));
  return gold;
}

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
  assert.ok(body.environment.ffmpeg === null || /^ffmpeg version /.test(body.environment.ffmpeg));
  assert.ok(body.environment.ffprobe === null || /^ffprobe version /.test(body.environment.ffprobe));
  if (process.platform !== 'darwin' || process.arch !== 'arm64') assert.equal(body.operational_result, 'UNTESTED — TARGET HARDWARE EXECUTION REQUIRED');
});

test('corpus verifier blocks absent bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-')), output = join(root, 'corpus.json');
  assert.equal(spawnSync(process.execPath, [runner, 'verify-corpus', '--corpus', corpus, '--media-root', root, '--output', output], { encoding: 'utf8' }).status, 0);
  const body = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(body.results.length, 6);
  assert.ok(body.results.every(item => item.operational_result === 'BLOCKED'));
  assert.match(body.exact_representation_gate, /^NOT PASS/);
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
  const protectedFields = body.sources.map(({ id, local_filename, sha256, duration_seconds, source_type, candidate_modalities, gold_evidence_state }) => ({ id, local_filename, sha256, duration_seconds, source_type, candidate_modalities, gold_evidence_state }));
  assert.deepEqual(protectedFields, [
    { id: 'ashley-social-01', local_filename: 'ashley-social-01.mp4', sha256: 'd812ae5ab34b95063fdf8d56d9e05d24c3acac23c98ec0f4a83e150a80faab15', duration_seconds: 27.466667, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'edited_shots'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-02', local_filename: 'ashley-social-02.mp4', sha256: 'd8a3587aa2e32c0fd8d0b7a4271544b21768a42b3325d75fa67321255de27ab9', duration_seconds: 32.166667, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'other_on_screen_text', 'edited_shots'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-04', local_filename: 'ashley-social-04.mp4', sha256: '7336ec9715c52021ff14fa40403a0f86291b60be2f2f1f44472e5c9ad163092f', duration_seconds: 15.135593, source_type: 'finished_social', candidate_modalities: ['speech', 'speaker_change_candidate', 'burned_in_caption'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-05', local_filename: 'ashley-social-05.mp4', sha256: '4549c6e9880e13d2a9f54d34092349cc5deb422755a2f4a8686e73c80b81dd9f', duration_seconds: 94.363039, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'other_on_screen_text', 'edited_shots'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-08', local_filename: 'ashley-social-08.mp4', sha256: 'b06c101bcf7b5a69699ebc7abd2f5c8e8ef9161910fd715cd24db1253772c28e', duration_seconds: 15.566667, source_type: 'finished_social', candidate_modalities: ['speech', 'outdoor_text_or_signage_candidate'], gold_evidence_state: 'incomplete' },
    { id: 'ashley-social-10', local_filename: 'ashley-social-10.mp4', sha256: '32bb074d859df59e091a23a141bc67ec32f8afd3c2f9c70e5988ed0aa0092e62', duration_seconds: 10.819002, source_type: 'finished_social', candidate_modalities: ['speech', 'burned_in_caption', 'other_on_screen_text', 'outdoor_text_or_signage_candidate'], gold_evidence_state: 'incomplete' }
  ]);
});

test('social-05 preserves frozen bytes and separately records its observed drift representation', async () => {
  const body = JSON.parse(await readFile(corpus, 'utf8'));
  const source = body.sources.find(item => item.id === 'ashley-social-05');
  assert.equal(source.sha256, '4549c6e9880e13d2a9f54d34092349cc5deb422755a2f4a8686e73c80b81dd9f');
  assert.equal(source.frozen_representation.sha256, source.sha256);
  assert.equal(source.observed_representations[0].sha256, '66060820a5861f75673521855b51de362c17a02c1cb8111549ea1ceabf33f6a2');
  assert.equal(source.observed_representations[0].identity_outcome, 'LOGICAL_SOURCE_CONTINUITY_WITH_REPRESENTATION_DRIFT');
  assert.equal(source.logical_source.id, 'Dcdz3BAOFwG');
});

test('exact SHA match remains distinguishable from representation drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-'));
  const { processResult, body } = await runIdentityFixture(root, identitySource(), 'frozen');
  assert.equal(processResult.status, 0);
  assert.equal(body.exact_representation_gate, 'PASS');
  assert.equal(body.results[0].identity_verification_outcome, 'EXACT_REPRESENTATION_MATCH');
  assert.equal(body.results[0].exact_representation_match, true);
});

test('same URL plus different SHA alone is source identity unresolved', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-'));
  const { processResult, body } = await runIdentityFixture(root, identitySource(), 'different bytes');
  assert.equal(processResult.status, 0);
  assert.equal(body.exact_representation_gate.startsWith('NOT PASS'), true);
  assert.equal(body.results[0].identity_verification_outcome, 'SOURCE_IDENTITY_UNRESOLVED');
});

test('similar declared duration plus different SHA cannot promote logical continuity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-'));
  const source = identitySource();
  source.duration_seconds = 94.249002;
  source.frozen_representation.duration_seconds = 94.249002;
  const { body } = await runIdentityFixture(root, source, 'different bytes');
  assert.equal(body.results[0].identity_verification_outcome, 'SOURCE_IDENTITY_UNRESOLVED');
});

test('documented independent provenance permits drift but never an exact match', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-')), driftBytes = 'drift representation', driftHash = hash(driftBytes);
  const source = identitySource({ observed: [{ representation_id: `mediaasset-sha256-${driftHash}`, sha256: driftHash, identity_outcome: 'LOGICAL_SOURCE_CONTINUITY_WITH_REPRESENTATION_DRIFT', observed_logical_source_id: 'post-a', logical_continuity: { evidence: [{ type: 'platform_post_id_observed' }, { type: 'historical_representation_provenance' }] } }] });
  const { body } = await runIdentityFixture(root, source, driftBytes);
  assert.equal(body.results[0].identity_verification_outcome, 'LOGICAL_SOURCE_CONTINUITY_WITH_REPRESENTATION_DRIFT');
  assert.equal(body.results[0].exact_representation_match, false);
  assert.equal(body.exact_representation_gate.startsWith('NOT PASS'), true);
});

test('different logical post is WRONG_SOURCE, never continuity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-')), wrongBytes = 'wrong post bytes', wrongHash = hash(wrongBytes);
  const source = identitySource({ observed: [{ representation_id: `mediaasset-sha256-${wrongHash}`, sha256: wrongHash, identity_outcome: 'WRONG_SOURCE', observed_logical_source_id: 'post-b' }] });
  const { body } = await runIdentityFixture(root, source, wrongBytes);
  assert.equal(body.results[0].identity_verification_outcome, 'WRONG_SOURCE');
  assert.equal(body.results[0].logical_source_continuity, 'FAILED');
});

test('missing continuity provenance cannot be promoted to representation drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-')), driftBytes = 'unproven drift', driftHash = hash(driftBytes);
  const source = identitySource({ observed: [{ representation_id: `mediaasset-sha256-${driftHash}`, sha256: driftHash, identity_outcome: 'LOGICAL_SOURCE_CONTINUITY_WITH_REPRESENTATION_DRIFT', observed_logical_source_id: 'post-a', logical_continuity: { evidence: [{ type: 'source_url_only' }] } }] });
  const { processResult } = await runIdentityFixture(root, source, driftBytes);
  assert.notEqual(processResult.status, 0);
  assert.match(processResult.stderr, /lacks independent logical-continuity provenance/);
});

test('human-gold validator binds every record to frozen corpus identity without claiming quality', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-'));
  const gold = await writeGoldFixture(root), output = join(root, 'human-gold-validation.json');
  assert.equal(spawnSync(process.execPath, [runner, 'validate-gold', '--gold', gold, '--corpus', corpus, '--output', output], { encoding: 'utf8' }).status, 0);
  const body = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(body.receipt_type, 'human_gold_validation');
  assert.equal(body.operational_result, 'PASS');
  assert.equal(body.quality_result, 'NOT_APPLICABLE');
  assert.equal(body.results.length, 6);
  assert.ok(body.results.every(result => result.gold_completion_state === 'incomplete'));
});

test('human-gold validator rejects a SHA mismatch instead of scoring a different source as gold', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-'));
  const gold = await writeGoldFixture(root, body => { body.sources[0].source_sha256 = '0'.repeat(64); return body; });
  const result = spawnSync(process.execPath, [runner, 'validate-gold', '--gold', gold, '--corpus', corpus, '--output', join(root, 'ignored.json')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Human-gold SHA-256 does not match frozen corpus identity/);
});

test('human-gold validator rejects a false complete claim with unresolved evidence lanes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abc-benchmark-test-'));
  const gold = await writeGoldFixture(root, body => {
    body.sources[0].review.coverage_state = 'complete_source_direct_human_review';
    body.sources[0].gold_completion_state = 'complete';
    return body;
  });
  const result = spawnSync(process.execPath, [runner, 'validate-gold', '--gold', gold, '--corpus', corpus, '--output', join(root, 'ignored.json')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot claim complete gold/);
});
