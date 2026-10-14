import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore} from '../src/control/service.js';
const active='## Current active workstreams\n### Mary Kate / AI operating system — ACTIVE NOW\n**Current stage:** Conversation acceptance\n**Current assessment:** Component evidence only\n### Video analyzer — ACTIVE / PARALLEL\n**Current stage:** Cloud repair\n## Session handoff rule\n';
const index='| Mary Kate current V1 completion/gap/evidence status | `research/ai-workflows/assessment.md` | `ACTIVE_WORK.md` |';
const assessment='V1 completion assessment: hosted acceptance unverified.';
async function setup({offer='We can inspect the V1 readiness and explain the missing proof. We will not write files.',user='Tell me what we can check for MK V1.',stale=false,truncated=false,queued=false}={}) {
  let clock=Date.now(),calls=0,packet;
  const reads=[],store=createMemoryStore({now:()=>new Date(clock).toISOString()});
  await store.addInteraction({raw_text:user,route:{route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary:offer}});
  if(stale)clock+=600000;
  if(truncated){const recent=store.listRecentConversation;store.listRecentConversation=async()=>({...await recent(),truncated:true});}
  if(queued)await store.addQueueItem({interaction_id:'i1',responsibility:'needs_ashley',plain_summary:'An unrelated pending proposal'});
  const service=createControlService({now:()=>clock,store,github:{readFile:async(_repo,path)=>{reads.push(path);return {sha:'fixture-'+path,content:path==='ACTIVE_WORK.md'?active:path==='PROJECT_INDEX.md'?index:assessment};}},router:{route:async(_text,p)=>{calls++;packet=p;return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary:'Controlled transport probe, not semantic acceptance.'};}}});
  return {service,store,reads,get calls(){return calls;},get packet(){return packet;}};
}
test('fresh single read-only offer binds assent and retrieves existing indexed authority',async()=>{
  const f=await setup();const result=await f.service.capture('Sure.');
  assert.equal(f.calls,1);assert.equal(f.packet.intent,'read_only_assessment');
  assert.equal(f.packet.read_only_continuation.permission_authority,false);
  assert.equal(f.packet.completion_authority.content,assessment);
  assert.deepEqual(f.reads,['ACTIVE_WORK.md','PROJECT_INDEX.md','research/ai-workflows/assessment.md']);
  assert.equal(result.queue_item,null);assert.deepEqual(await f.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
});
test('assent with alternative, consequential, stale, truncated or competing offers stays blocked',async()=>{
  for(const options of [{offer:'I can read the assessment or inspect the next proof.'},{offer:'I can read the V1 assessment and deploy the repair.'},{offer:'I can read the assessment and inspect the next proof.'},{stale:true},{truncated:true},{queued:true},{user:'Tell me about both MK and Video analyzer V1.'}]) {
    const f=await setup(options);await assert.rejects(()=>f.service.capture('Yes, agreed.'),e=>e.code==='ambiguous_scope');assert.equal(f.calls,0);
  }
});
test('topic return is an inert conversation request; appended execution never borrows it',async()=>{
  const f=await setup({offer:'We paused the campaign at edit review.',user:'The video campaign is at edit review.'});
  await f.service.capture('Okay, back to the video.');
  assert.equal(f.packet.intent,'read_only_advice');assert.equal(f.packet.ambiguity_gate.section,null);
  assert.equal(f.packet.ambiguity_gate.reason,'conversation_navigation_read_only');
  const g=await setup({offer:'We paused the campaign.',user:'The video campaign is at edit review.'});
  await g.service.capture('Back to Video analyzer. Run it.');
  assert.equal(g.packet.intent,undefined);
});
