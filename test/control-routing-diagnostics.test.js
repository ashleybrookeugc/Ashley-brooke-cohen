import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkersAiRoutingAdapter,createOpenRouterFreeAdapter} from '../src/control/adapters.js';
import {createControlService,createMemoryStore,createD1Store,controlErrorResponse} from '../src/control/service.js';
const valid={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Saved without a write.'};
const malformed={...valid,proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Mary Kate',field:'Next',value:'Bearer sensitive-value'}};
const active='## Current active workstreams\n\n### Mary Kate\n**Next bounded action:** Verify production\n\n## Session handoff rule\n';
const setup=output=>{
 const store=createMemoryStore();let writes=0;
 const router=createWorkersAiRoutingAdapter({CONTROL_MODEL_API_KEY:'credentialfixture',AI:{run:async()=>output}});
 const app=createControlService({github:{readFile:async()=>({content:active,sha:'sha'}),writeFile:async()=>{writes++;}},router,store});
 return {app,store,writes:()=>writes};
};
test('malformed route fails closed and sanitized validator evidence survives in history',async()=>{
 const payload={tool_calls:[{name:'submit_control_route',arguments:{...malformed,authorization:'Bearer credentialfixture',private_key:'privatefixture',why:'sk-live-secret',proposal:{...malformed.proposal,password:'passwordfixture'}}}],token:'tokenfixture'};
 const {app,store,writes}=setup(payload);let failure;
 await assert.rejects(app.capture('Set the next bounded action'),error=>{failure=error;return error.code==='routing_contract_invalid';});
 assert.equal(failure.diagnostic.validation.path,'proposal.field');
 assert.equal(failure.diagnostic.validation.reason,'Invalid state proposal');
 assert.equal(failure.diagnostic.provider,'workers-ai');
 assert.equal(failure.diagnostic.model,'@cf/meta/llama-3.1-8b-instruct-fp8');
 assert.equal(failure.diagnostic.rejected_route.proposal.field,'Next');
 assert.deepEqual(failure.diagnostic.rejected_route.proposal.value,{type:'string',length:22});
 const rows=await store.listHistory(20);assert.equal(rows.length,1);assert.equal(rows[0].outcome_status,'failed');assert.equal(rows[0].id,failure.interaction_id);assert.deepEqual(rows[0].diagnostic,failure.diagnostic);assert.equal(rows[0].receipt,null);
 const persisted=JSON.stringify(rows);for(const secret of ['credentialfixture','privatefixture','passwordfixture','tokenfixture','sk-live-secret','sensitive-value'])assert.ok(!persisted.includes(secret),secret);
 assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});assert.equal(writes(),0);
 const response=controlErrorResponse(failure);assert.equal(response.interaction_id,rows[0].id);assert.equal(response.technical.diagnostic.validation.path,'proposal.field');assert.match(response.error,/No change was saved/);
});
test('known credentials and unknown provider payloads never survive categorical evidence',async()=>{
 const {app,store}=setup({tool_calls:[{name:'submit_control_route',arguments:{...valid,confidence:'credentialfixture'}}],unrelated:{headers:{authorization:'Bearer extra-secret'}}});
 await assert.rejects(app.capture('update'),e=>e.diagnostic.validation.path==='confidence');
 const row=(await store.listHistory(20))[0];assert.deepEqual(row.diagnostic.rejected_route.confidence,{type:'string',length:17});assert.ok(!JSON.stringify(row).includes('extra-secret'));assert.ok(!JSON.stringify(row).includes('credentialfixture'));
});
test('provider parser failure retains shape, not raw prose or secrets',async()=>{
 const {app,store}=setup({response:'Bearer private-token arbitrary prose'});await assert.rejects(app.capture('update'),e=>e.code==='routing_tool_call_missing');
 const d=(await store.listHistory(20))[0].diagnostic;assert.equal(d.validation.path,'tool_calls');assert.equal(d.rejected_route.type,'string');assert.ok(!JSON.stringify(d).includes('private-token'));
});
test('valid routing remains unchanged and produces no failure diagnostic',async()=>{
 const {app,store}=setup({tool_calls:[{name:'submit_control_route',arguments:valid}]});const result=await app.capture('remember this');assert.equal(result.route_kind,valid.route_kind);const row=(await store.listHistory(20))[0];assert.equal(row.outcome_status,'captured');assert.equal(row.diagnostic,null);
});
test('OpenRouter validation preserves provider and exact rule',async()=>{
 const router=createOpenRouterFreeAdapter({CONTROL_OPENROUTER_API_KEY:'secret'}, {fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({...valid,confidence:'impossible'})}}]})})});
 await assert.rejects(router.route('update',{}),e=>e.diagnostic.provider==='openrouter'&&e.diagnostic.validation.path==='confidence'&&e.diagnostic.rejected_route.confidence==='impossible');
});
test('D1 failure rows use existing route_json and history marks them failed without receipts',async()=>{
 const records=[];let params,sql;
 const db={prepare:query=>({bind:(...values)=>{params=values;sql=query;return {run:async()=>records.push({query,values}),all:async()=>({results:[{id:'correlation',route_json:records[0].values[2],outcome_status:null}]})};}})};
 const store=createD1Store(db,{id:()=> 'correlation'});const diagnostic={version:'control-routing-failure.v1',status:'failed',validation:{path:'confidence',reason:'Invalid confidence'}};
 await store.addInteraction({raw_text:'[omitted]',route:{...valid,outcome_status:'failed',diagnostic}});const rows=await store.listHistory(20);assert.equal(records.length,1);assert.match(records[0].query,/INSERT INTO control_interactions/);assert.equal(rows[0].outcome_status,'failed');assert.deepEqual(rows[0].diagnostic,diagnostic);assert.equal(rows[0].receipt,null);
});
test('rejected idea target retains original privately without inventing a canonical destination',async()=>{
 const input='I have an idea about the time a short audition takes to film.';
 const output={tool_calls:[{name:'submit_control_route',arguments:{route_kind:'side_idea',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Save the idea',proposal:{target_repo:'fixture/invalid-target',target_path:'SIDE_IDEAS.md',operation:'append_side_idea',title:'Audition effort',body:input,scope:'acting'}}}]};
 const {app,store,writes}=setup(output);let failure;
 await assert.rejects(app.capture(input),error=>{failure=error;return error.code==='routing_contract_invalid';});
 const row=(await store.listHistory(1))[0];
 assert.equal(row.raw_text,input);assert.equal(row.outcome_status,'failed');assert.equal(row.receipt,null);
 assert.equal(row.diagnostic.validation.path,'proposal.target_repo');
 assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});assert.equal(writes(),0);
 const response=controlErrorResponse(failure);
 assert.equal(response.capture_status,'retained_private');assert.match(response.error,/No change was saved/);
 assert.ok(!JSON.stringify(response).includes(input),'private input must not be echoed in the error response');
});
test('failed routing preserves original in existing D1 raw_text column, not diagnostic payload',async()=>{
 const input='A synthetic creative idea requiring recoverable capture';const rows=[];
 const db={prepare:query=>({bind:(...values)=>({run:async()=>rows.push({query,values})})})};
 const store=createD1Store(db,{id:()=> 'retained-input'});
 const app=createControlService({store,github:{readFile:async()=>({content:active,sha:'base'})},router:createWorkersAiRoutingAdapter({AI:{run:async()=>({response:'invalid provider prose Bearer private-token'})}})});
 // Supply cache operations separately; this scenario isolates D1 interaction persistence.
 const cache=createMemoryStore();for(const method of ['getContextPacket','putContextPacket','listQueues','listHistory'])store[method]=cache[method];
 await assert.rejects(app.capture(input),error=>error.interaction_id==='retained-input');
 const inserted=rows.find(row=>row.query.startsWith('INSERT INTO control_interactions'));
 assert.equal(inserted.values[1],input);assert.ok(!inserted.values[2].includes(input));assert.ok(!inserted.values[2].includes('private-token'));
});
