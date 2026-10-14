import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const fixtures=JSON.parse(readFileSync(new URL('../scripts/acceptance/real-conversation-failures-20261014.json',import.meta.url),'utf8'));
test('real incident fixtures are distinct and source-grounded',()=>{
 assert.equal(fixtures.version,'mary-kate.real-conversation-failures.v1');
 assert.equal(fixtures.cases.length,7);
 assert.equal(new Set(fixtures.cases.map(x=>x.id)).size,fixtures.cases.length);
 for(const x of fixtures.cases){
  assert.ok(x.context.length>0 && x.user && x.observed && x.expected && x.status && x.gate);
  assert.ok(['FAIL_OBSERVED_IN_CHAT','PARTIAL_DIAGNOSTIC_NO_REPRO','NOT_RUN_AGAINST_MK'].includes(x.status));
 }
});
test('historical chat failures are not mislabeled as live Mary Kate passes',()=>{
 assert.match(fixtures.source,/actual Mary Kate live inference NOT executed/);
 assert.equal(fixtures.cases.filter(x=>x.status==='FAIL_OBSERVED_IN_CHAT').length,5);
 assert.equal(fixtures.cases.filter(x=>x.status==='NOT_RUN_AGAINST_MK').length,1);
});
test('the known false frame pass and GitHub rejection remain negative evidence',()=>{
 const frames=fixtures.cases.find(x=>x.id==='false-frame-pass');
 assert.match(frames.expected,/block completed status/);
 const writes=fixtures.cases.find(x=>x.id==='github-write-diagnostic');
 assert.match(writes.expected,/do not claim root cause fixed/);
});
