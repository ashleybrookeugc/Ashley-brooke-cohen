import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCanonicalFacts} from '../src/control/contracts.js';
import {createAmbiguityGate,createControlService,createMemoryStore} from '../src/control/service.js';

const current=['## Current active workstreams',
  '### Mary Kate / AI operating system — ACTIVE NOW','**Current stage:** V1 proof','**Next bounded action:** Verify the route',
  '### Shared video-understanding / evidence engine — ACTIVE / PARALLEL','**Current stage:** Benchmark','**Next bounded action:** Verify source identity',
  '### ContentEase / UGC Creator App — ACTIVE / PARALLEL','**Current stage:** Media library','**Next bounded action:** Inspect a rough cut',
  '### UGC / creator campaign and editing operations — ACTIVE / PARALLEL','**Current stage:** Campaign review','**Next bounded action:** Review source evidence',
  '### Pop-Up Radar / event + casting discovery — PAUSED / RESUMABLE','**Current stage:** Resume later','**Next bounded action:** Verify the mobile flow',
  '## Session handoff rule'].join('\n');
const facts=parseCanonicalFacts(current);

test('authoritative ambiguity overrides any candidate claim of clear continuation',()=>{
  assert.equal(createAmbiguityGate('Fine, carry on.',facts).reason,'unbound_continuation');
  assert.equal(createAmbiguityGate('Go ahead with the one we discussed',facts).reason,'unbound_continuation');
  const video=createAmbiguityGate('Make video analysis a priority and tell me the next steps',facts);
  assert.equal(video.status,'blocked');
  assert.equal(video.reason,'multiple_current_referents');
  assert.ok(video.candidates.length>1);
});

test('ambiguous current work stops before model routing or an approval item',async()=>{
  let routerCalls=0;
  const store=createMemoryStore();
  const service=createControlService({github:{readFile:async()=>({content:current,sha:'source'})},store,router:{route:async()=>{routerCalls++;throw new Error('model must not run');}}});
  await assert.rejects(()=>service.capture('Fine, carry on.'),error=>error.code==='ambiguous_scope');
  await assert.rejects(()=>service.capture('Make video analysis a priority and tell me the next steps'),error=>error.code==='ambiguous_scope');
  assert.equal(routerCalls,0);
  assert.equal((await store.listQueues()).needs_ashley.length,0);
  assert.equal((await store.listHistory(10)).length,0);
});

test('an explicit canonical workstream binds the model to that one target',async()=>{
  let routerCalls=0;
  const github={readFile:async()=>({content:current,sha:'source'})};
  const store=createMemoryStore();
  const router={route:async()=>{routerCalls++;return {route_kind:'state_update',responsibility:'needs_ashley',confidence:'high',plain_summary:'Update stage',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Pop-Up Radar / event + casting discovery — PAUSED / RESUMABLE',field:'Current stage',value:'Ready'}}}};
  const service=createControlService({github,store,router});
  await assert.rejects(()=>service.capture('Update Mary Kate current stage'),error=>error.code==='routing_contract_invalid');
  assert.equal(routerCalls,1);
  assert.equal((await store.listQueues()).needs_ashley.length,0);
});

test('an unbound state proposal cannot create an approval item',async()=>{
  const github={readFile:async()=>({content:current,sha:'source'})};
  const store=createMemoryStore();
  const router={route:async()=>({route_kind:'state_update',responsibility:'needs_ashley',confidence:'high',plain_summary:'Update stage',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Mary Kate / AI operating system — ACTIVE NOW',field:'Current stage',value:'Ready'}})};
  const service=createControlService({github,store,router});
  await assert.rejects(()=>service.capture('Update the current stage'),error=>error.code==='ambiguous_scope');
  assert.equal((await store.listQueues()).needs_ashley.length,0);
});
