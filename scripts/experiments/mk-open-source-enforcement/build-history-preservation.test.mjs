import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const directory=new URL('./',import.meta.url);

async function retrieveFromFreshSession(query) {
  const index=JSON.parse(await readFile(new URL('build-history-index.json',directory),'utf8'));
  const words=query.toLowerCase().split(/\W+/).filter(word=>word.length>3);
  const hit=index.records.find(entry=>entry.aliases.some(alias=>words.some(word=>alias.toLowerCase().includes(word))));
  if(!hit) return null;
  return JSON.parse(await readFile(new URL(hit.record,directory),'utf8'));
}

test('fresh session retrieves the complete enforcement history without a filename',async()=>{
  const record=await retrieveFromFreshSession('Continue the Mary Kate automatic enforcement comparison');
  assert.equal(record.task_id,'mk-open-source-enforcement-2026-10-14');
  assert.deepEqual(record.stages.map(stage=>stage.status),['failed','disproven','corrected','passed','unresolved']);
});

test('failure, hypothesis, correction, verification, and limitation stay distinct and linked',async()=>{
  const record=await retrieveFromFreshSession('What happened in the OPA experiment?');
  const stages=Object.fromEntries(record.stages.map(stage=>[stage.id,stage]));
  assert.equal(stages['opa-wasm-first-run'].kind,'observed_result');
  assert.equal(stages['opa-wasm-incompatibility-hypothesis'].kind,'hypothesis');
  assert.deepEqual(stages['opa-wasm-incompatibility-hypothesis'].disproven_by,['rego-portability-correction','opa-wasm-regression-pass']);
  assert.deepEqual(stages['rego-portability-correction'].repairs,['opa-wasm-first-run']);
  assert.ok(stages['opa-wasm-regression-pass'].evidence.length>=3);
  assert.equal(stages['cloudflare-runtime-smoke-limitation'].status,'unresolved');
});

test('later success does not overwrite the original failure and public record contains no sensitive payloads',async()=>{
  const record=await retrieveFromFreshSession('Resume automatic enforcement');
  assert.equal(record.stages.length,5);
  assert.ok(record.stages.some(stage=>stage.status==='failed'));
  assert.ok(record.stages.some(stage=>stage.status==='passed'));
  const serialized=JSON.stringify(record);
  assert.doesNotMatch(serialized,/BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|authorization:\s*bearer|private footage/i);
});
