import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCanonicalFacts} from '../src/control/contracts.js';
import {createAmbiguityGate,createControlService,createMemoryStore} from '../src/control/service.js';

// These cases were generated independently of the guard implementation. Keep
// the expected decisions frozen before executing the holdout.
const HOLDOUT_DOCUMENT=['# Active Work','',
  '## Current active workstreams','',
  '### Mary Kate / AI operating system — ACTIVE NOW','**Current stage:** V1 proof','**Next bounded action:** Verify the route',
  '### Shared video-understanding / evidence engine — ACTIVE / PARALLEL','**Current stage:** Benchmark','**Next bounded action:** Verify source identity',
  '### ContentEase / UGC Creator App — ACTIVE / PARALLEL','**Current stage:** Media library','**Next bounded action:** Inspect a rough cut',
  '### Ashley Brooke Cohen / professional website — ACTIVE / PARALLEL','**Current stage:** Content system','**Next bounded action:** Verify the public flow',
  '### B-Paid — WAITING FOR ASHLEY','**Current stage:** Awaiting approval','**Next bounded action:** Confirm the offer',
  '### Pop-Up Radar / event + casting discovery — PAUSED / RESUMABLE','**Current stage:** Resume later','**Next bounded action:** Verify the mobile flow',
  '','## Session handoff rule'].join('\n');
const facts=parseCanonicalFacts(HOLDOUT_DOCUMENT);
const NO_ACTIVE_DOCUMENT=['# Active Work','','## Current active workstreams','',
  '### B-Paid — WAITING FOR ASHLEY','**Current stage:** Awaiting approval',
  '### Pop-Up Radar / event + casting discovery — PAUSED / RESUMABLE','**Current stage:** Resume later',
  '','## Session handoff rule'].join('\n');
const noActiveFacts=parseCanonicalFacts(NO_ACTIVE_DOCUMENT);

const FROZEN_HOLDOUT_CASES=Object.freeze([
  {id:'mk-next-plain',text:"What's next?",status:'blocked',reason:'unbound_workstream_request'},
  {id:'video-next-paraphrase',text:'Can you tell me what should happen next?',status:'blocked',reason:'unbound_workstream_request'},
  {id:'ugc-current-action',text:'What is the current action?',status:'blocked',reason:'unbound_workstream_request'},
  {id:'website-advance',text:'Advance the project.',status:'blocked',reason:'unbound_workstream_request'},
  {id:'stale-temporal-continuation',text:'Continue the completed Temporal thread.',status:'blocked',reason:'unbound_continuation'},
  {id:'vague-assent',text:'Yes, approve the old proposal.',status:'blocked',reason:'unbound_continuation'},
  {id:'conflicting-cross-project-approval',text:'Use Shared video-understanding / evidence engine to update Ashley Brooke Cohen / professional website.',status:'blocked',reason:'multiple_current_referents'},
  {id:'explicit-mary-kate',text:'Continue Mary Kate next.',status:'passed',section:'Mary Kate / AI operating system — ACTIVE NOW'},
  {id:'explicit-video-switch',text:'Switch to Shared video-understanding / evidence engine.',status:'passed',section:'Shared video-understanding / evidence engine — ACTIVE / PARALLEL'},
  {id:'explicit-bpaid',text:'What is next for B-Paid?',status:'passed',section:'B-Paid — WAITING FOR ASHLEY'},
  {id:'ordinary-conversation',text:'The rough cut needs another review.',status:'passed',section:null},
  {id:'missing-workstream-evidence',text:'What should I do next?',status:'blocked',reason:'missing_workstream_context',document:'no-active'}
]);

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
  const blocked=FROZEN_HOLDOUT_CASES.filter(entry=>entry.status==='blocked');
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
