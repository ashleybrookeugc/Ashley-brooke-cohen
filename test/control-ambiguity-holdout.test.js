import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCanonicalFacts} from '../src/control/contracts.js';
import {createAmbiguityGate,createControlService,createMemoryStore} from '../src/control/service.js';
import {FROZEN_HOLDOUT_CASES,HOLDOUT_DOCUMENT,NO_ACTIVE_DOCUMENT} from '../eval/cases/phrasing-fixtures.js';

// These cases were generated independently of the guard implementation. Keep
// the expected decisions frozen before executing the holdout. The phrase table
// lives in eval/cases/phrasing-fixtures.js so promptfoo runs the same bytes.
const facts=parseCanonicalFacts(HOLDOUT_DOCUMENT);
const noActiveFacts=parseCanonicalFacts(NO_ACTIVE_DOCUMENT);

test('independent frozen ambiguity holdout preserves both safety and valid binding',()=>{
  for(const entry of FROZEN_HOLDOUT_CASES) {
    const entryFacts=entry.document==='no-active'?noActiveFacts:facts;
    const result=createAmbiguityGate(entry.text,entryFacts);
    assert.equal(result.status,entry.status,entry.id);
    if(entry.reason) assert.equal(result.reason,entry.reason,entry.id);
    if(entry.section) assert.equal(result.section,entry.section,entry.id);
    if(entry.id==='mk-next-plain') assert.deepEqual(result.candidates,[
      'Mary Kate / AI operating system — ACTIVE NOW',
      'Shared video-understanding / evidence engine — ACTIVE / PARALLEL',
      'ContentEase / UGC Creator App — ACTIVE / PARALLEL',
      'Ashley Brooke Cohen / professional website — ACTIVE / PARALLEL'
    ]);
  }
});

test('frozen unsafe holdout requests stop before routing, history, or queues',async()=>{
  // The original pure ambiguity holdout above stays frozen. Whole-workload
  // advice now has its own inert service path, including waiting/blocked work.
  const supersededAdvice=new Set(['missing-workstream-evidence','mk-next-plain','video-next-paraphrase']);
  const blocked=FROZEN_HOLDOUT_CASES.filter(entry=>entry.status==='blocked'&&!supersededAdvice.has(entry.id));
  for(const entry of blocked) {
    let routerCalls=0;
    const store=createMemoryStore();
    const service=createControlService({
      github:{readFile:async()=>({content:entry.document==='no-active'?NO_ACTIVE_DOCUMENT:HOLDOUT_DOCUMENT,sha:'holdout-source'})},
      store,
      router:{route:async()=>{routerCalls++;return {route_kind:'state_update',responsibility:'needs_ashley',confidence:'high',plain_summary:'unsafe candidate',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Mary Kate / AI operating system — ACTIVE NOW',field:'Current stage',value:'unsafe'}}}}
    });
    await assert.rejects(()=>service.capture(entry.text),error=>error.code==='ambiguous_scope',entry.id);
    assert.equal(routerCalls,0,entry.id);
    assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]},entry.id);
    assert.deepEqual(await store.listHistory(10),[],entry.id);
  }
});

test('unique explicit workstream binding and ordinary conversation are not over-blocked',async()=>{
  for(const text of ['Continue Mary Kate next.','Switch to Shared video-understanding / evidence engine.','What is next for B-Paid?','The rough cut needs another review.']) {
    let routerCalls=0;
    let packet;
    const service=createControlService({
      github:{readFile:async()=>({content:HOLDOUT_DOCUMENT,sha:'holdout-source'})},
      store:createMemoryStore(),
      router:{route:async(_text,next)=>{routerCalls++;packet=next;return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'held for context'};}}
    });
    const result=await service.capture(text);
    assert.equal(result.route_kind,'temporary_context',text);
    assert.equal(routerCalls,1,text);
    assert.equal(packet.ambiguity_gate.status,'passed',text);
  }
});
