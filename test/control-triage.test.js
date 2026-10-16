import test from 'node:test';
import assert from 'node:assert/strict';
import {triageRequest,modelTaskProfile} from '../src/control/triage.js';
import {createControlService,createMemoryStore,createD1Store} from '../src/control/service.js';
import {createWorkersAiRoutingAdapter,createPolicyRoutingAdapter} from '../src/control/adapters.js';

const content=`## Current focus
**Workstream:** Video analyzer
**Do next:** Review a real video from start to finish and improve the edit advice.
## Current active workstreams
### Video analyzer — ACTIVE / PARALLEL
**Next bounded action:** Verify the uploaded video.
### Mary Kate — ACTIVE NOW
**Next bounded action:** Check the repaired chat.
**Current assessment:** Production acceptance is unverified.
### B-Paid — BLOCKED
**Current blocker:** Waiting for the signed agreement.
## Session handoff rule
`;
const answer={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Here is the answer.'};
const questions=[
  'what to prioritize next', 'What should I prioritize next?', 'What should I do today?',
  'Could you tell me what deserves my attention?', 'Help me decide what to focus on.',
  'Show me my current work.', 'Give me an overview of my active projects.',
  'What should we tackle next?', 'Which priorities are blocked?', 'What are our blockers?',
  'So, what should I focus on next?', 'What needs my attention today?',
  "What's next?", 'What’s next?', 'Can you tell me what should happen next?'
];
function setup(router,clock=()=>0) {
  let reads=0,writes=0;const store=createMemoryStore({now:()=>new Date(clock()).toISOString()});
  const service=createControlService({store,router,now:clock,github:{
    readFile:async()=>{reads++;return {content,sha:'current-work-sha'};},
    writeFile:async()=>{writes++;throw Error('must not write');}
  }});
  return {service,store,get reads(){return reads;},get writes(){return writes;}};
}
test('equivalent prioritization requests retrieve evidence and answer with zero model calls',async()=>{
  for(const input of questions){
    const run=setup({route(){assert.fail('No model dispatch: '+input);}});
    const result=await run.service.capture(input);
    assert.equal(result.triage.mode,'priority_advice',input);
    assert.equal(result.model_selection.calls,0,input);
    assert.equal(result.queue_item,null);
    assert.equal(run.reads,1);
    assert.equal(run.writes,0);
    assert.match(result.plain_summary,/Video processing is the current focus/i,input);
    assert.match(result.plain_summary,/Review a real video from start to finish/i);
    assert.doesNotMatch(result.plain_summary,/repaired chat|signed agreement/i);
    const row=(await run.store.listHistory(1))[0];
    assert.equal(row.route.prior_state.material[0].sha,'current-work-sha');
    assert.equal(row.route.proposal,undefined);
    assert.deepEqual(await run.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
  }
});
test('natural priority follow-ups are free and cached work is refreshed at expiry',async()=>{
  let time=0;const run=setup({route(){assert.fail('No model dispatch');}},()=>time);
  await run.service.capture('what to prioritize next');
  for(const input of ['Which one first?', 'And what about the blockers?', 'Anything else?']){
    const result=await run.service.capture(input);assert.equal(result.model_selection.calls,0,input);
  }
  assert.equal(run.reads,1);
  time=300001;
  await run.service.capture('What are my priorities?');assert.equal(run.reads,2);
});
test('explicit project advice stays scoped; missing evidence does not invent priorities',async()=>{
  const run=setup({route(){assert.fail('No model dispatch');}});
  const result=await run.service.capture('What should I prioritize for Video analyzer?');
  assert.match(result.plain_summary,/Review a real video from start to finish/);
  assert.doesNotMatch(result.plain_summary,/Check the repaired chat|signed agreement/);
  const empty=createControlService({store:createMemoryStore(),router:{route(){assert.fail();}},github:{readFile:async()=>({content:'# Empty work',sha:'empty'})}});
  assert.match((await empty.capture('What should I prioritize?')).plain_summary,/could not find any current projects/i);
});
test('advice versus explicit or mixed action: no new mutation authority',()=>{
  for(const input of ['Should I deploy this?', 'How would you fix this bug?', 'Do not deploy anything.', 'I mean which model should I select?'])
    assert.equal(triageRequest(input).read_only,true,input);
  for(const input of ['Please deploy it.', 'Can you update Video analyzer?', 'What are my priorities? Delete the old files.',
    'Tell me my priorities and then approve the proposal.', 'Show current work; send the report.', 'No, change Video analyzer stage.'])
    assert.equal(triageRequest(input).read_only,false,input);
});
test('unfamiliar ordinary questions use the tool-free answering adapter and retain exact follow-up turns',async()=>{
  const requests=[];const router=createWorkersAiRoutingAdapter({AI:{run:async(_model,request)=>{requests.push(request);return {response:'Here is useful advice.'};}}});
  const run=setup(router);
  const history=[];
  for(const input of ['I am overwhelmed and could use some guidance.', 'Why would that help?', 'I mean which setting should I select?']){
    const result=await run.service.capture(input,{conversationHistory:history});
    const request=requests.at(-1);
    assert.equal(request.tools,undefined);
    assert.equal(request.max_tokens,700);
    assert.equal(request.messages.at(-1).content,input);
    assert.equal(result.queue_item,null);
    assert.equal(result.triage.max_model_calls,1);
    history.push({role:'user',text:input},{role:'assistant',text:result.plain_summary});
  }
  assert.equal(requests.length,3);
  assert.ok(requests[2].messages.some(x=>x.role==='assistant'&&x.content==='Here is useful advice.'));
});
test('hostile conversation output is still rejected, and mixed/unbound actions remain gated',async()=>{
  const run=setup({route:async()=>({...answer,route_kind:'state_update'})});
  await assert.rejects(()=>run.service.capture('I am overwhelmed.'),{code:'read_only_route_violation'});
  await assert.rejects(()=>run.service.capture('Tell me my priorities and then update the current stage.'),{code:'ambiguous_scope'});
  assert.deepEqual(await run.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
  assert.equal(run.writes,0);
});
test('difficulty is based on requested work, not project keywords or the previous difficult task',()=>{
  const context={intent:'read_only_advice',recent_conversation:{turns:[{role:'user',content:'How should I debug this code?'}]}};
  for(const input of ['Hello','What is the status of the code repair?', 'What should I prioritize next?',
    'What does analysis mean?', 'I mean which model and thinking effort should I select?'])
    assert.equal(modelTaskProfile(input,context),'conversation',input);
  assert.equal(modelTaskProfile('How should I debug this code?',context),'coding');
  assert.equal(modelTaskProfile('Compare these options',context),'reasoning');
  assert.equal(modelTaskProfile('What about that?',context),'coding');
});

test('ordinary advice uses at most one existing provider call and no provider fallback',async()=>{
  let calls=0,fallback=0;
  const router=createPolicyRoutingAdapter({}, {deterministic:{route:async()=>null},workers:{route:async()=>{calls++;return answer;}},openrouter:{route:async()=>{fallback++;return answer;}}});
  const run=setup(router);
  const result=await run.service.capture('How can you help me?');
  assert.equal(calls,1);assert.equal(fallback,0);assert.equal(result.model_selection.calls,1);
});

test('deployed legacy router also respects the one-call triage ceiling on quota errors',async()=>{
  let calls=0,fallback=0;
  const router=createPolicyRoutingAdapter({}, {deterministic:{route:async()=>null},workers:{route:async()=>{calls++;throw Error('Workers AI 429 quota');}},openrouter:{route:async()=>{fallback++;return answer;}}});
  const run=setup(router);
  await assert.rejects(()=>run.service.capture('How can you help me?'),{code:'model_provider_failed'});
  assert.equal(calls,1);assert.equal(fallback,0);
});
test('a complete follow-up question gets one answer instead of a lexical clarification loop',async()=>{
  let calls=0;const router=createWorkersAiRoutingAdapter({AI:{run:async()=>{calls++;return {response:'Use the setting suited to debugging.'};}}});
  const run=setup(router);
  await run.service.capture('And which model and thinking effort should I select?');
  assert.equal(calls,1);
});
test('D1 history retains the inert priority marker for a following turn without exposing raw text',async()=>{
  const store=createD1Store({prepare:()=>({bind:()=>({all:async()=>({results:[{id:'i1',plain_summary:'Current priorities',route_json:JSON.stringify({...answer,raw_text:'private',model_selection:{provider:'none',calls:0,task:'priority_advice'}})}]})})})});
  const row=(await store.listHistory(1))[0];
  assert.equal(row.model_selection.task,'priority_advice');assert.equal(row.raw_text,undefined);
  assert.equal(triageRequest('Which one first?',{lastRoute:row,recent:{truncated:false}}).mode,'priority_advice');
});
test('priority projection cannot silently choose between conflicting recorded next actions',async()=>{
  const service=createControlService({store:createMemoryStore(),router:{route(){assert.fail('No dispatch');}},github:{readFile:async()=>({content:content.replace('**Next bounded action:** Check the repaired chat.','**Next bounded action:** Check the repaired chat.\n**Next bounded action:** Deploy immediately.'),sha:'conflicting'})}});
  await assert.rejects(()=>service.capture('What should I prioritize next?'),{code:'conflict'});
});
test('waiting-only current work is a read-only answer rather than an invented active priority',async()=>{
  const service=createControlService({store:createMemoryStore(),router:{route(){assert.fail('No dispatch');}},github:{readFile:async()=>({content:'## Current active workstreams\n### Video analyzer — WAITING FOR ASHLEY\n**Current blocker:** Need the source clip.\n## Session handoff rule',sha:'waiting'})}});
  const result=await service.capture('What should I do next?');
  assert.match(result.plain_summary,/Need the source clip/);assert.equal(result.model_selection.calls,0);
});
test('conversational next is not a request for global Next fields across different projects',async()=>{
  const source=content.replace('**Next bounded action:** Verify the uploaded video.','**Next:** Verify the uploaded video.').replace('**Next bounded action:** Check the repaired chat.','**Next:** Check the repaired chat.');
  const service=createControlService({store:createMemoryStore(),router:{route(){assert.fail('No dispatch');}},github:{readFile:async()=>({content:source,sha:'different-next-fields'})}});
  const result=await service.capture('what to prioritize next');
  assert.match(result.plain_summary,/Review a real video from start to finish/);assert.doesNotMatch(result.plain_summary,/repaired chat/);
});
test('a named priority and its elliptical follow-up do not silently switch to other projects',async()=>{
  const run=setup({route(){assert.fail('No dispatch');}});
  await run.service.capture('What should I prioritize for Video analyzer?');
  const result=await run.service.capture('Which one first?');
  assert.match(result.plain_summary,/Review a real video from start to finish/);assert.doesNotMatch(result.plain_summary,/repaired chat/);
});
test('keyword collisions remain normal questions, not workload summaries or action permission',()=>{
  for(const input of ['Which camera focus setting should I use?', 'What is a priority queue?', 'What does blocked mean?', 'How does CSS priority work?']) {
    const result=triageRequest(input);assert.equal(result.mode,'conversation',input);assert.equal(result.read_only,true);
  }
});
test('missing inference is identified before a call, without invoking another provider',async()=>{
  let fallback=0;const router=createPolicyRoutingAdapter({}, {openrouter:{route:async()=>{fallback++;return answer;}}});
  const run=setup(router);
  await assert.rejects(()=>run.service.capture('How can you help me?'),{code:'inference_unavailable'});
  assert.equal(fallback,0);
});
