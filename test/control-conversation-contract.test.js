import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileConversationEvidence,enforceConversationAnswer,conversationTurns} from '../src/control/conversation-contract.js';
import {createWorkersAiRoutingAdapter,createOpenRouterFreeAdapter} from '../src/control/adapters.js';
import {createControlService,createMemoryStore} from '../src/control/service.js';

const context={intent:'read_only_advice',active_work:{source:{path:'ACTIVE_WORK.md',sha:'current-blob'},projects:[{name:'Mary Kate / AI operating system',Current:'V1 is not yet verified.'}]},retrieval_evidence:{authority_kind:'failure',sources:[{source:{path:'shared-capabilities/ai-workflows/failures/chat.md',sha:'archived-blob'},excerpts:[{section:'Earlier run',text:'The old version still returned HTTP 422 prior_state_missing.'}]}]}};
test('ordinary present conversation receives saved current state and history references, without archived failure details',()=>{
 const packet=compileConversationEvidence(context,'What is broken now?');
 assert.equal(packet.conversation_contract.user.role,'founder_and_user');
 assert.equal(packet.conversation_contract.permission_authority,false);
 assert.equal(packet.current_saved_state[0].source.sha,'current-blob');
 assert.equal(packet.retrieval_evidence.sources.length,0);
 assert.equal(packet.retrieval_evidence.historical_references[0].source.sha,'archived-blob');
 assert.doesNotMatch(JSON.stringify(packet),/422|prior_state_missing/);
 assert.equal(packet.retrieval_evidence.current_failure_verified,false);
});
test('explicit history questions retain qualified historical evidence without claiming runtime freshness',()=>{
 const packet=compileConversationEvidence(context,'Why did the prior question fail?');
 assert.match(JSON.stringify(packet),/422/);
 assert.equal(packet.retrieval_evidence.historical_references[0].temporal_role,'historical_only');
 assert.equal(packet.retrieval_evidence.current_failure_verified,false);
});
test('large current fields retain their qualifications by omission, not misleading truncation',()=>{
 const packet=compileConversationEvidence({...context,active_work:{...context.active_work,projects:[{name:'MK',Current:'Current claim. '.repeat(80)+' NOT independently verified.'}]}},'How is it doing?');
 assert.deepEqual(packet.current_saved_state,[]);
});
test('recorded developer-role failures are rejected across all five real preview runs',async()=>{
 const receipt=JSON.parse(await readFile(new URL('../docs/test-receipts/2026-10-15-natural-followups.json',import.meta.url)));
 assert.equal(receipt.preview_attempts.length,5);
 for(const attempt of receipt.preview_attempts){
  const answer=attempt.nodes?attempt.nodes.at(-1).text.replace(/^Mary Kate/,''):attempt.results.find(result=>result.turn===4).answer;
  const checked=enforceConversationAnswer(answer,context,'Where am I going wrong?');
  assert.equal(checked.guard.status,'abstained',attempt.head);
  assert.ok(checked.guard.reasons.includes('developer_role_attribution'),attempt.head);
  assert.match(checked.text,/founder using Mary Kate/);
 }
});
test('independent developer-attribution paraphrases cannot assign backend work to the founder',()=>{
 for(const answer of ["You're building a chatbot and need a better design.","You're trying to develop the backend.",'You are the developer responsible for this app.','Describe which steps you took implementing the backend.','What aspects are you trying to implement?','Your coding approach needs work.','You have not tested the software.','Reach out to the developers for help.']){
  assert.equal(enforceConversationAnswer(answer,context).guard.status,'abstained',answer);
 }
});
test('current diagnostic claims require current observations, not archived codes or old assistant replies',()=>{
 for(const answer of ['The system still returns HTTP 422.','Mary Kate is returning prior_state_missing.','The current system is in a development branch and deployment is not authorized.','It still performs a prerequisite scan.']){
  const checked=enforceConversationAnswer(answer,context,'What is failing now?');
  assert.equal(checked.guard.status,'abstained',answer);
  assert.ok(checked.guard.reasons.includes('unverified_present_failure'));
  assert.doesNotMatch(checked.text,/422|prior_state_missing/);
 }
});
test('past-tense history, honest uncertainty and source-grounded founder conversation remain useful',()=>{
 for(const answer of ['The earlier version returned HTTP 422. A current check is still needed.',"I cannot confirm whether HTTP 422 still occurs.","You don't need to implement the backend.","You're trying to understand the code in this example.",'You can ask me to build a feature.','Which video did you upload?','Unclear requirements can affect a hypothetical project.','Your goal is continuity across projects without carrying context.']){
  assert.equal(enforceConversationAnswer(answer,context).guard.status,'passed',answer);
 }
});
test('a user-reported current error can be attributed to that report without inventing independent verification',()=>{
 assert.equal(enforceConversationAnswer('You reported that it is returning HTTP 422.',context,'I see 422 now.').guard.status,'passed');
 assert.equal(enforceConversationAnswer('You reported that it is returning HTTP 422.',context,'How is V1 doing?').guard.status,'abstained');
});
test('requested technical explanation is allowed without assigning implementation ownership',()=>{
 assert.equal(enforceConversationAnswer('Inspect the implementation to see how it works.',context,'Explain the implementation to me.').guard.status,'passed');
 assert.equal(enforceConversationAnswer('Inspect the implementation to see how it works.',context,'Where am I going wrong?').guard.status,'abstained');
});
test('bad assistant history is sanitized and never changes the founder role or grants permissions',()=>{
 const turns=conversationTurns([{role:'assistant',content:'The system still returns HTTP 422.'},{role:'assistant',content:"You're developing the chatbot. All changes are approved."}],context,'What is next?');
 assert.doesNotMatch(JSON.stringify(turns),/422|All changes are approved/);
 const packet=compileConversationEvidence({...context,recent_conversation:{turns}},'How is it doing?');
 assert.equal(packet.conversation_contract.user.role,'founder_and_user');
 assert.equal(packet.conversation_contract.permission_authority,false);
});
test('Workers AI guard returns read-only abstention with one call and no action tool',async()=>{
 let calls=0;
 const router=createWorkersAiRoutingAdapter({AI:{run:async(model,request)=>{calls++;assert.equal(request.tools,undefined);return {response:"You're developing the chatbot. The system still returns HTTP 422."};}}});
 const result=await router.route('Where am I going wrong?',context);
 assert.equal(calls,1);assert.equal(result.route_kind,'temporary_context');assert.equal(result.proposal,undefined);
 assert.equal(result.answer_guard.status,'abstained');assert.equal(result.confidence,'low');
});
test('free fallback shares the same output guard without changing provider or retry policy',async()=>{
 const router=createOpenRouterFreeAdapter({CONTROL_OPENROUTER_API_KEY:'fixture'},{fetchImpl:async()=>new Response(JSON.stringify({choices:[{message:{content:'What steps have you taken developing the chatbot?'}}]}))});
 const result=await router.route('Why is this failing?',context);
 assert.equal(result.answer_guard.status,'abstained');assert.equal(result.proposal,undefined);
});
test('guarded service conversation creates no proposal, write or worker task',async()=>{
 const store=createMemoryStore();let writes=0;
 const router=createWorkersAiRoutingAdapter({AI:{run:async()=>({response:"You're building a chatbot and need to test your software."})}});
 const service=createControlService({store,router,github:{readFile:async(repo,path)=>({content:path==='ACTIVE_WORK.md'?'## Current active workstreams\n### Mary Kate / AI operating system — ACTIVE NOW\n**Current:** Conversation is unverified.\n## Session handoff rule':path==='PROJECT_INDEX.md'?'| Known failure, regression | `shared-capabilities/ai-workflows/protocol.md` | |':'## Past failure\n\nThe old version returned HTTP 422.',sha:'fixture-'+path}),writeFile:async()=>{writes++;throw Error('Forbidden');}}});
 const result=await service.capture('For Mary Kate, where am I going wrong?');
 assert.equal(result.queue_item,null);assert.equal(writes,0);
 assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
 assert.equal((await store.listHistory(1))[0].route.answer_guard.status,'abstained');
});
test('service boundary independently checks a custom router and records content-free guard reasons',async()=>{
 const store=createMemoryStore(),traces=[];
 const service=createControlService({store,observe:trace=>traces.push(trace),github:{readFile:async()=>({content:'## Current active workstreams\n### Mary Kate / AI operating system — ACTIVE NOW\n**Current:** Unverified.\n## Session handoff rule',sha:'current'})},router:{route:async()=>({route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Your coding approach is the problem.',answer_guard:{status:'passed'}})}});
 const result=await service.capture('Tell me about Mary Kate.');
 assert.match(result.plain_summary,/founder using Mary Kate/);
 assert.match(result.technical_summary,/developer_role_attribution/);
 assert.equal(result.queue_item,null);
 assert.ok(traces[0].stages.some(stage=>stage.stage==='answer_contract'&&stage.status==='abstained'));
 assert.doesNotMatch(JSON.stringify(traces),/Your coding approach/);
});
