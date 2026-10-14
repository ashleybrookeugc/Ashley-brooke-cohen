import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore,normalizeConversationHistory} from '../src/control/service.js';

const active=`# Active Work
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

test('a follow-up inherits the last uniquely named workstream and carries bounded history to routing',async()=>{
  let packet;
  const router={route:async(_text,next)=>{packet=next;return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Choose the saved B-Paid source video first.'}}};
  const app=createControlService({github,router,store:createMemoryStore()});
  const history=[{role:'user',text:'Tell me what is happening with B-Paid.'},{role:'assistant',text:'The source-video choice is still open.'}];
  const result=await app.capture('What should I do first?',{contextWorkstream:'mary-kate-command-center',conversationHistory:history,conversationId:'session_12345678'});
  assert.equal(packet.ambiguity_gate.section,'B-Paid — ACTIVE / PARALLEL');
  assert.deepEqual(packet.conversation_history,history);
  assert.equal(result.conversation_id,'session_12345678');
  assert.equal(result.handoff.status,'conversation_active');
});

test('a cross-project prioritization question is read-only and is not stopped as ambiguous',async()=>{
  let calls=0,packet;
  const router={route:async(_text,next)=>{calls++;packet=next;return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Start with the phone acceptance, then choose the B-Paid source video.'}}};
  const app=createControlService({github,router,store:createMemoryStore()});
  const result=await app.capture('I need help with time management. Can you prioritize all project tasks?',{contextWorkstream:'mary-kate-command-center'});
  assert.equal(calls,1);
  assert.equal(packet.intent,'read_only_assessment');
  assert.equal(packet.ambiguity_gate.scope,'all_current_workstreams');
  assert.match(result.plain_summary,/phone acceptance/);
});

test('tracked work is distinguished from conversation and from a running worker',async()=>{
  const router={route:async()=>({route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Track the B-Paid source choice',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'B-Paid',field:'Next bounded action',value:'Choose one saved source video.'}})};
  const app=createControlService({github,router,store:createMemoryStore()});
  const result=await app.capture('Update B-Paid so the next task is choosing one saved source video.',{contextWorkstream:'mary-kate-command-center'});
  assert.equal(result.handoff.status,'tracked');
  assert.equal(result.handoff.can_clear,true);
  assert.match(result.handoff.message,/not shown as running until a worker actually checks in/i);
});

test('conversation history is bounded and rejects malformed or oversized context',()=>{
  assert.deepEqual(normalizeConversationHistory(null),[]);
  assert.throws(()=>normalizeConversationHistory([{role:'system',text:'hidden'}]),/user or assistant/);
  assert.throws(()=>normalizeConversationHistory(Array.from({length:13},()=>({role:'user',text:'turn'}))),/at most 12/);
});
