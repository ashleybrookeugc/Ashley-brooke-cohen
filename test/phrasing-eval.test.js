import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import LocalRoutingProvider from '../eval/providers/local-routing.js';
import PaidModelRefused from '../eval/providers/paid-model-refused.js';
import cases from '../eval/cases/phrasing-suite.js';
import assertRouting from '../eval/assert-routing.js';
import {FROZEN_HOLDOUT_CASES, priorityQuestions, readonlyPositive} from '../eval/cases/phrasing-fixtures.js';

test('promptfoo phrasing suite stays on the local provider and covers the frozen phrases', async () => {
  const config = await readFile(new URL('../eval/promptfooconfig.yaml', import.meta.url), 'utf8');
  const providerSource = await readFile(new URL('../eval/providers/local-routing.js', import.meta.url), 'utf8');
  const suiteSource = await readFile(new URL('../eval/cases/phrasing-suite.js', import.meta.url), 'utf8');
  const providerIds = [...config.matchAll(/^\s*- id:\s*(\S+)/gm)].map(match => match[1]);
  assert.deepEqual(providerIds, ['file://providers/local-routing.js']);
  assert.doesNotMatch(providerSource, /\bfetch\s*\(/);
  assert.doesNotMatch(providerSource, /vars\.expected/);
  assert.doesNotMatch(suiteSource, /src\/control\/triage/);
  assert.equal(new Set(cases.map(item => item.description)).size, cases.length);
  for (const phrase of priorityQuestions) {
    assert.ok(cases.some(item => item.vars.kind === 'triage' && item.vars.input === phrase));
    assert.ok(cases.some(item => item.vars.kind === 'priority_capture' && item.vars.input === phrase));
  }
  for (const entry of FROZEN_HOLDOUT_CASES) assert.ok(cases.some(item => item.description === `ambiguity:${entry.id}`));
  for (const phrase of readonlyPositive) assert.ok(cases.some(item => item.vars.kind === 'ambiguity' && item.vars.input === phrase));
});

test('local routing provider satisfies the frozen phrasing suite with no model call', async () => {
  const provider = new LocalRoutingProvider({config: {network: 'forbidden'}});
  assert.throws(() => new LocalRoutingProvider(), /forbidden/);
  const failures = [];
  for (const item of cases) {
    const result = await provider.callApi(item.description, {vars: item.vars});
    const verdict = await assertRouting(result.output, {vars: item.vars});
    if (verdict?.pass !== true) failures.push(verdict?.reason || item.description);
  }
  assert.deepEqual(failures, []);
});

test('paid model config cannot run from the default phrasing command', async () => {
  const paid = await readFile(new URL('../eval/promptfooconfig.paid.yaml', import.meta.url), 'utf8');
  const script = await readFile(new URL('../scripts/eval-phrasing.mjs', import.meta.url), 'utf8');
  assert.match(paid, /paid-model-refused/);
  assert.match(script, /eval\/promptfooconfig\.yaml/);
  assert.doesNotMatch(script, /promptfooconfig\.paid\.yaml/);
  const provider = new PaidModelRefused();
  const previous = process.env.PROMPTFOO_ENABLE_PAID_MODELS;
  delete process.env.PROMPTFOO_ENABLE_PAID_MODELS;
  await assert.rejects(() => provider.callApi('unused'), /Paid model evals are off/);
  process.env.PROMPTFOO_ENABLE_PAID_MODELS = '1';
  await assert.rejects(() => provider.callApi('unused'), /no model endpoint/);
  if (previous === undefined) delete process.env.PROMPTFOO_ENABLE_PAID_MODELS;
  else process.env.PROMPTFOO_ENABLE_PAID_MODELS = previous;
});
