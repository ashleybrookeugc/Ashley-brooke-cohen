import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore} from '../src/control/service.js';

const work=`## Current execution priority
**Current objective:** Make Mary Kate answer ordinary questions from current saved evidence.
**Next bounded action:** Check the remaining real questions and natural follow-ups against the released repair.
**Current blocker:** The first priority answer works, but its wording and broader usefulness are not accepted.
## Current active workstreams
### Mary Kate / AI operating system — ACTIVE NOW
**Current:** An older checkpoint remains for history.
**Next bounded action:** Rebuild the old Save key fixture abcdef1234567890.
### Video analyzer — ACTIVE / PARALLEL
**Current:** Phone usefulness is unverified.
**Next:** Test the creator workflow on one real recording.
## Session handoff rule
`;
function setup(content=work) {
  let calls=0,writes=0,reads=0;const store=createMemoryStore();
  const service=createControlService({store,github:{readFile:async()=>{reads++;return {content,sha:'current-priority-source'};},writeFile:async()=>{writes++;throw Error('Forbidden');}},router:{route:async()=>{calls++;throw Error('No inference allowed');}}});
  return {service,store,get calls(){return calls;},get writes(){return writes;},get reads(){return reads;}};
}
test('ordinary advice reads the explicit execution priority instead of an older project Next',async()=>{
  for(const input of ['What should I do today?','What should I prioritize next?']) {
    const run=setup();const result=await run.service.capture(input);
    assert.match(result.plain_summary,/ordinary questions/);
    assert.match(result.plain_summary,/remaining real questions/);
    assert.match(result.plain_summary,/not accepted/);
    assert.doesNotMatch(result.plain_summary,/Save key|abcdef|ACTIVE NOW|Video analyzer/);
    assert.ok(result.plain_summary.length<650);
    assert.equal(result.model_selection.calls,0);assert.equal(run.calls,0);assert.equal(run.writes,0);assert.equal(run.reads,1);
    const retrieval=result.retrieval_trace.stages.find(x=>x.stage==='retrieval');
    assert.equal(retrieval.sources[0].sha,'current-priority-source');
    assert.equal(retrieval.section,'Current execution priority');
    assert.deepEqual(retrieval.fields,['current-objective','next-bounded-action','current-blocker']);
    assert.ok(!JSON.stringify(result.retrieval_trace).includes('ordinary questions'));
    assert.deepEqual(await run.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
  }
});
test('priority continuation keeps the selected authority; explicit project questions stay scoped',async()=>{
  const run=setup();await run.service.capture('What should I do today?');
  assert.match((await run.service.capture('Which one first?')).plain_summary,/remaining real questions/);
  const named=await run.service.capture('What should I prioritize for Video analyzer?');
  assert.match(named.plain_summary,/Test the creator workflow/);assert.doesNotMatch(named.plain_summary,/ordinary questions/);
  assert.match((await run.service.capture('Which one first?')).plain_summary,/Test the creator workflow/);
});
test('a single execution focus cannot hide the projects or blockers in an overview',async()=>{
  for(const input of ['Give me an overview of my active projects.','What are our blockers?']) {
    const run=setup();const result=await run.service.capture(input);
    assert.match(result.plain_summary,/Video analyzer/);assert.match(result.plain_summary,/unverified/);
    assert.equal(run.calls,0);assert.equal(run.writes,0);
  }
});
test('conflicting or incomplete explicit priority facts cannot silently fall back to older tasks',async()=>{
  for(const [source,code] of [
    [work.replace('## Current active workstreams','**Next bounded action:** Deploy immediately.\n## Current active workstreams'),'conflict'],
    [work.replace(/^\*\*Next bounded action:.*\n/m,''),'missing']
  ]) {
    const run=setup(source);await assert.rejects(()=>run.service.capture('What should I prioritize next?'),{code});
    assert.equal(run.calls,0);assert.equal(run.writes,0);assert.deepEqual(await run.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
  }
});
test('oversized priority text stays honest and never cuts off its qualification',async()=>{
  const source=work.replace('Make Mary Kate answer ordinary questions from current saved evidence.','Check '+ 'the evidence '.repeat(80)+'but this is NOT verified.');
  const run=setup(source);const result=await run.service.capture('What should I do today?');
  assert.match(result.plain_summary,/too detailed|too long/i);assert.doesNotMatch(result.plain_summary,/Your current focus is: Check/);
  assert.equal(result.model_selection.calls,0);assert.equal(run.writes,0);
});
test('explicit priority does not weaken caller requirements or mixed-command ambiguity',async()=>{
  const run=setup();
  await assert.rejects(()=>run.service.capture('What should I do today?',{requiredFactKeys:['absent-evidence']}),{code:'missing'});
  await assert.rejects(()=>run.service.capture('What should I do today? Update the priority.'),{code:'ambiguous_scope'});
  assert.equal(run.calls,0);assert.equal(run.writes,0);assert.deepEqual(await run.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
});
