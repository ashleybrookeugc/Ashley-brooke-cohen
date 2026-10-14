import test from 'node:test';
import assert from 'node:assert/strict';
import {taskProfile,selectModel,automaticModelStatus,createAutomaticModelRouter,createModelUsageStore} from '../src/control/automatic-models.js';
const context={intent:'read_only_advice',recent_conversation:{turns:[]}};
const free={CONTROL_WORKERS_FREE_PLAN_CONFIRMED:'true',AI:{async run(){return {response:'Useful answer'};}},CONTROL_MODEL_ACCEPTANCE:'llama:conversation,qwen:reasoning,coder:coding'};
const paid={CONTROL_SPENDING_POLICY:'explicit test policy',CONTROL_ALLOW_PAID_MODELS:'true',CONTROL_OPENAI_API_KEY:'private-key',CONTROL_OPENAI_MODEL:'configured-model',CONTROL_MODEL_ACCEPTANCE:'openai:conversation,openai:coding',CONTROL_MODEL_DAILY_MICRO_USD:'100000',CONTROL_OPENAI_INPUT_USD_PER_MILLION:'2',CONTROL_OPENAI_OUTPUT_USD_PER_MILLION:'10',CONTROL_OPENAI_PRICE_VERIFIED_AT:'2026-10-14T21:00:00Z'};
const now=()=>Date.parse('2026-10-14T21:01:00Z');
test('selection separates conversation, coding, reasoning and action; registry does not influence task',()=>{
 assert.equal(taskProfile('Hello',context),'conversation');assert.equal(taskProfile('Compare these options',context),'reasoning');assert.equal(taskProfile('How should I debug this code?',context),'coding');assert.equal(taskProfile('Implement it',{}),'action');
 assert.equal(taskProfile('Hello',{...context,active_work:{projects:[{name:'Code repair'}]}}),'conversation');
 assert.equal(selectModel(free,'Hello',context).id,'llama');assert.equal(selectModel(free,'Compare options',context).id,'qwen');assert.equal(selectModel(free,'How should I debug this code?',context).id,'coder');
});
test('unaccepted model blocks before any provider call; unavailable compatible models do not become paid fallback',async()=>{
 let calls=0;const router=createAutomaticModelRouter({AI:{run(){calls++;}},CONTROL_OPENAI_API_KEY:'key',CONTROL_OPENAI_MODEL:'test'});
 await assert.rejects(()=>router.route('Hello',context),{code:'model_not_ready'});assert.equal(calls,0);
 assert.throws(()=>selectModel({...free,...paid,CONTROL_ALLOW_PAID_MODELS:'false',AI:null},'Hello',context),{code:'model_not_ready'});
 assert.throws(()=>selectModel(paid,'Update a project',{}),{code:'model_not_ready'});
});
test('one selected free call and reservation, no classifier call, no paid request; inert answer',async()=>{
 const calls=[],reservations=[];let paidCalls=0;
 const router=createAutomaticModelRouter({...free,AI:{async run(...args){calls.push(args);return{response:'Here is an answer'};}}},{usageStore:{async reserve(x){reservations.push(x);return true;}},fetchImpl(){paidCalls++;}});
 const r=await router.route('Compare these options',context);assert.equal(calls.length,1);assert.equal(paidCalls,0);assert.equal(calls[0][0],'@cf/qwen/qwen3-30b-a3b-fp8');assert.equal(calls[0][1].tools,undefined);assert.equal(r.proposal,undefined);assert.equal(r.model_selection.calls,1);assert.equal(reservations[0].microUsd,0);assert.ok(reservations[0].neurons>0);
});
test('notes and unresolved clarification use zero calls and no reservation',async()=>{
 let calls=0;const router=createAutomaticModelRouter({}, {usageStore:{reserve(){calls++;}},fetchImpl(){calls++;}});
 assert.equal((await router.route('note keep this',context)).model_selection.calls,0);
 assert.equal((await router.route('And unknown words',context)).model_selection.calls,0);assert.equal(calls,0);
});
test('daily allowance rejection and oversized context produce zero calls',async()=>{
 let calls=0;const env={...free,AI:{run(){calls++;}}};const router=createAutomaticModelRouter(env,{usageStore:{async reserve(){return false;}}});
 await assert.rejects(()=>router.route('Hello',context),{code:'model_budget_limit'});
 await assert.rejects(()=>router.route('x'.repeat(25000),context),{code:'model_context_limit'});assert.equal(calls,0);
});
test('free provider failure does not retry, expose provider error, or switch to paid',async()=>{
 let calls=0;const router=createAutomaticModelRouter({...free,AI:{run(){calls++;throw Error('secret provider text');}}},{usageStore:{async reserve(){return true;}},fetchImpl(){throw Error('must not run');}});
 await assert.rejects(()=>router.route('Hello',context),e=>e.code==='model_provider_failed'&&!e.message.includes('secret'));assert.equal(calls,1);
});
test('OpenAI uses exact role history, configured effort/output cap, no tools, one reservation and no retained provider state',async()=>{
 let calls=0;const reservations=[];const router=createAutomaticModelRouter(paid,{now,usageStore:{async reserve(x){reservations.push(x);return true;}},async fetchImpl(url,options){calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.reasoning.effort,'high');assert.equal(body.max_output_tokens,1400);assert.deepEqual(body.input.slice(-3),[{role:'user',content:'Old question'},{role:'assistant',content:'Prior answer'},{role:'user',content:'How should I debug this code?'}]);return Response.json({status:'completed',output:[{type:'reasoning'},{type:'message',role:'assistant',content:[{type:'output_text',text:'Use this approach.'}]}]});}});
 const r=await router.route('How should I debug this code?',{...context,recent_conversation:{turns:[{role:'user',content:'Old question'},{role:'assistant',content:'Prior answer'}]}});assert.equal(calls,1);assert.equal(r.route_kind,'temporary_context');assert.ok(reservations[0].microUsd>0);assert.equal(r.plain_summary,'Use this approach.');
});
test('paid missing/stale budget, unapproved payment and incomplete output never silently fall back',async()=>{
 let calls=0;for(const env of [{...paid,CONTROL_MODEL_DAILY_MICRO_USD:'0'},{...paid,CONTROL_OPENAI_PRICE_VERIFIED_AT:'2026-10-12'},{...paid,CONTROL_OPENAI_OUTPUT_USD_PER_MILLION:'NaN'}]){const router=createAutomaticModelRouter(env,{now,fetchImpl(){calls++;}});await assert.rejects(()=>router.route('Hello',context),{code:'model_budget_missing'});}assert.equal(calls,0);
 const router=createAutomaticModelRouter(paid,{now,usageStore:{async reserve(){return true;}},async fetchImpl(){calls++;return Response.json({status:'incomplete',output:[]});}});await assert.rejects(()=>router.route('Hello',context),{code:'model_answer_incomplete'});assert.equal(calls,1);
});
test('status does not leak secrets or claim checks passed by connection presence',()=>{const s=automaticModelStatus({...paid,CONTROL_MODEL_ACCEPTANCE:''});assert.equal(s.enabled,false);assert.equal(s.paid_connected,true);assert.deepEqual(s.models.at(-1).accepted_tasks,[]);assert.ok(!JSON.stringify(s).includes('private-key'));});
test('usage store uses one atomic conditional SQL reservation with UTC day and all limits',async()=>{let sql,args;const store=createModelUsageStore({prepare(q){sql=q;return{bind(...a){args=a;return{async first(){return {calls:1};}};}};}},{now});assert.equal(await store.reserve({neurons:20,microUsd:0,callLimit:25,neuronLimit:8000,microUsdLimit:0}),true);assert.match(sql,/ON CONFLICT\(day\) DO UPDATE/);assert.match(sql,/WHERE calls < \?/);assert.equal(args[0],'2026-10-14');});

test('authenticated status route reads configuration without D1 or model dispatch; unauthorized request is denied',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/control-worker.js',import.meta.url),'utf8');
 const worker=new Function('deps',`const {app,isAdmin,controlPage,myWorkPage,videoBrowserTestPage,conversationTestPage,conversationCorpus,conversationRevision,createConversationTestSurface,automaticModelStatus}=deps;\n${source.replace(/^import .*;\n/gm,'').replace('export default {','return {')}`)({app:{},isAdmin:async request=>request.headers.get('x-test-auth')==='yes',createConversationTestSurface:()=>async()=>null,automaticModelStatus,controlPage:'',myWorkPage:'',videoBrowserTestPage:'',conversationTestPage:'',conversationCorpus:{},conversationRevision:{}});
 let touched=0;const env={DB:{exec(){touched++;throw Error('must not touch D1');}},AI:{run(){touched++;}},CONTROL_OPENAI_API_KEY:'SECRET'};
 assert.equal((await worker.fetch(new Request('https://example.test/api/control/models'),env)).status,401);
 const r=await worker.fetch(new Request('https://example.test/api/control/models',{headers:{'x-test-auth':'yes'}}),env);assert.equal(r.status,200);const status=await r.json();assert.equal(status.mode,'free_only');assert.ok(!JSON.stringify(status).includes('SECRET'));assert.equal(touched,0);
});
test('free-tier dispatch requires a verified free account policy, not just a binding',()=>{
 assert.throws(()=>selectModel({...free,CONTROL_WORKERS_FREE_PLAN_CONFIRMED:'false'},'Hello',context),{code:'model_not_ready'});
});
