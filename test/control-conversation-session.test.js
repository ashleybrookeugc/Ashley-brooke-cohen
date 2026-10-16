import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore,normalizeConversationHistory,controlErrorResponse} from '../src/control/service.js';

const active=`# Active Work
## Current focus
**Workstream:** Mary Kate / AI operating system
**Do next:** Check a normal conversation and follow-up on the phone.
## Current active workstreams
### Mary Kate / AI operating system — ACTIVE NOW
**Current:** Command Center testing.
**Next bounded action:** Continue phone acceptance.
### B-Paid — ACTIVE / PARALLEL
**Current:** Video candidate review.
**Next bounded action:** Choose one source video.
## Session handoff rule
`;

const github={readFile:async()=>({content:active,sha:'a'.repeat(40)})};

test('a follow-up inherits the last uniquely named workstream and answers without a model call',async()=>{
  let calls=0;
  const router={route:async()=>{calls++;throw new Error('Routine priority advice should not dispatch a model');}};
  const app=createControlService({github,router,store:createMemoryStore()});
  const history=[{role:'user',text:'Tell me what is happening with B-Paid.'},{role:'assistant',text:'The source-video choice is still open.'}];
  const result=await app.capture('What should I do first?',{contextWorkstream:'mary-kate-command-center',conversationHistory:history,conversationId:'session_12345678'});
  assert.equal(calls,0);
  assert.match(result.plain_summary,/B-Paid.*project you asked about.*Choose one known messy source video/);
  assert.equal(result.conversation_id,'session_12345678');
  assert.equal(result.handoff.status,'conversation_active');
});

test('a cross-project prioritization question is read-only and needs no model call',async()=>{
  let calls=0;
  const router={route:async()=>{calls++;throw new Error('Routine priority advice should not dispatch a model');}};
  const app=createControlService({github,router,store:createMemoryStore()});
  const result=await app.capture('I need help with time management. Can you prioritize all project tasks?',{contextWorkstream:'mary-kate-command-center'});
  assert.equal(calls,0);
  assert.equal(result.model_selection.calls,0);
  assert.match(result.plain_summary,/Mary Kate.*current focus.*normal conversation and follow-up/);
  assert.doesNotMatch(result.plain_summary,/Choose one source video/);
});

test('tracked work is distinguished from conversation and from a running worker',async()=>{
  const router={route:async()=>({route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Track the B-Paid source choice',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'B-Paid',field:'Next bounded action',value:'Choose one saved source video.'}})};
  const app=createControlService({github,router,store:createMemoryStore()});
  const result=await app.capture('Update B-Paid so the next task is choosing one saved source video.',{contextWorkstream:'mary-kate-command-center'});
  assert.equal(result.handoff.status,'tracked');
  assert.equal(result.handoff.can_clear,true);
  assert.match(result.handoff.message,/unreviewed AI suggestion.*No worker has started/i);
});

test('conversation history is bounded and rejects malformed or oversized context',()=>{
  assert.deepEqual(normalizeConversationHistory(null),[]);
  assert.throws(()=>normalizeConversationHistory([{role:'system',text:'hidden'}]),/user or assistant/);
  assert.throws(()=>normalizeConversationHistory(Array.from({length:13},()=>({role:'user',text:'turn'}))),/at most 12/);
  assert.throws(()=>normalizeConversationHistory([{role:'assistant',text:'x'.repeat(2200)}]),/1–2000 characters/);
});

test('a long old assistant answer cannot make current priority advice report missing Project Truth',async()=>{
  const app=createControlService({github,router:{route(){assert.fail('No model call');}},store:createMemoryStore()});
  const longAnswer='Mary Kate / AI operating system and video processing. '.repeat(50);
  const history=[{role:'user',text:'What should I do today?'},{role:'assistant',text:longAnswer.slice(0,2000)}];
  const result=await app.capture('What should I do today?',{contextWorkstream:'mary-kate-command-center',conversationHistory:history});
  assert.match(result.plain_summary,/current focus/);
  assert.equal(result.model_selection.calls,0);
  try {await app.capture('What should I do today?',{conversationHistory:[{role:'assistant',text:longAnswer}]});assert.fail('Oversized context must be rejected');}
  catch(error){assert.equal(controlErrorResponse(error).code,'invalid_request');}
});
