import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_ROUTE_TOOL,RoutingContractError,createWorkersAiRoutingAdapter} from '../src/control/adapters.js';
import {MUTABLE_FIELDS} from '../src/control/contracts.js';
import {createControlService} from '../src/control/service.js';

const context={version:'control-task-packet.v1'};

test('Workers AI receives one schema-constrained control-route tool',async()=>{
  let request;
  const router=createWorkersAiRoutingAdapter({AI:{run:async(_model,input)=>{
    request=input;
    return {tool_calls:[{name:'submit_control_route',arguments:{route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Saved without a write.'}}]};
  }}});
  const route=await router.route('note this',context);
  assert.equal(route.route_kind,'temporary_context');
  assert.equal(request.tools.length,1);
  assert.equal(request.tools[0],CONTROL_ROUTE_TOOL);
  assert.match(request.messages[0].content,/calling submit_control_route exactly once/);
});

test('prose Workers AI output fails closed without a raw JSON parser exception',async()=>{
  const router=createWorkersAiRoutingAdapter({AI:{run:async()=>({response:'Here is the route you requested: state update'})}});
  await assert.rejects(()=>router.route('update this',context),error=>{
    assert.ok(error instanceof RoutingContractError);
    assert.equal(error.code,'routing_tool_call_missing');
    assert.equal(error.message,'Routing could not produce a valid control-plane result. No change was saved.');
    assert.doesNotMatch(error.message,/Unexpected token|Here is/);
    return true;
  });
});


test('the actual production field spelling is canonicalized through the finite field allowlist',async()=>{
  const proposal=CONTROL_ROUTE_TOOL.parameters.properties.proposal;
  assert.equal(proposal.type,'object');
  assert.equal(proposal.additionalProperties,false);
  assert.deepEqual(proposal.properties.target_repo.enum,['ashleybrookeugc/research-vault']);
  assert.deepEqual(proposal.properties.target_path.enum,['ACTIVE_WORK.md','SIDE_IDEAS.md']);
  assert.deepEqual(proposal.properties.operation.enum,['replace_field','append_side_idea']);
  assert.deepEqual(proposal.properties.field.enum,MUTABLE_FIELDS);
  let request;
  const router=createWorkersAiRoutingAdapter({AI:{run:async(_model,input)=>{
    request=input;
    return {tool_calls:[{name:'submit_control_route',arguments:{route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Set Mary Kate next action',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Mary Kate / AI operating system',field:'next-bounded-action',value:'Verify the V1 GitHub write contract through one approved production vertical slice.'}}}]};
  }}});
  const route=await router.route('Set the next bounded action',context);
  assert.equal(route.proposal.field,'Next bounded action');
  assert.match(request.messages[0].content,/canonical field label from its enum/);
});

test('unknown state fields still fail closed',async()=>{
  const router=createWorkersAiRoutingAdapter({AI:{run:async()=>({tool_calls:[{name:'submit_control_route',arguments:{route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Unknown field',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Mary Kate / AI operating system',field:'next-bounded-action-now',value:'No write'}}}]})}});
  await assert.rejects(()=>router.route('Set an unknown field',context),error=>{
    assert.ok(error instanceof RoutingContractError);
    assert.equal(error.diagnostic.validation.path,'proposal.field');
    assert.equal(error.diagnostic.validation.reason,'Invalid state proposal');
    return true;
  });
});


test('state proposal cannot escape the workstream resolved by prior-state evidence',async()=>{
  const active='## Current active workstreams\n\n### Mary Kate / AI operating system — **ACTIVE NOW**\n**Next bounded action:** Repair the write target invariant.  \n\n### Shared video-understanding / evidence engine — **ACTIVE / PARALLEL**\n**Next bounded action:** Finish the benchmark.  \n';
  let queued=false;
  const packet={projects:[],facts:[
    {id:'mk-next',key:'next-bounded-action',label:'Next bounded action',value:'Repair the write target invariant.',section:'Mary Kate / AI operating system — **ACTIVE NOW**'},
    {id:'video-next',key:'next-bounded-action',label:'Next bounded action',value:'Finish the benchmark.',section:'Shared video-understanding / evidence engine — **ACTIVE / PARALLEL**'}
  ],source:{repo:'ashleybrookeugc/research-vault',path:'ACTIVE_WORK.md',sha:'fixture'},created_at:'2026-10-04T00:00:00Z',expires_at:'2099-01-01T00:00:00Z'};
  const store={
    async getContextPacket(){return packet;},async putContextPacket(){},async invalidateContextPacket(){},
    async listQueues(){return{};},async listHistory(){return[];},
    async addInteraction(){throw new Error('unsafe route must be rejected before interaction storage');},
    async addQueueItem(){queued=true;}
  };
  const router={async route(){return {route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Unsafe cross-section proposal',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Shared video-understanding / evidence engine',field:'Next bounded action',value:'Wrong target'}};}};
  const service=createControlService({github:{async readFile(){return{content:active,sha:'fixture'};}},router,store});
  await assert.rejects(()=>service.capture('For Mary Kate, update the next bounded action',{requiredFactKeys:['next-bounded-action']}),error=>{
    assert.equal(error.code,'routing_contract_invalid');
    assert.equal(error.diagnostic.validation.path,'proposal.section');
    return true;
  });
  assert.equal(queued,false);
});

test('state proposal may target the workstream resolved by prior-state evidence',async()=>{
  const packet={projects:[],facts:[{id:'mk-next',key:'next-bounded-action',label:'Next bounded action',value:'Repair it.',section:'Mary Kate / AI operating system — **ACTIVE NOW**'}],source:{repo:'ashleybrookeugc/research-vault',path:'ACTIVE_WORK.md',sha:'fixture'},created_at:'2026-10-04T00:00:00Z',expires_at:'2099-01-01T00:00:00Z'};
  let savedRoute;
  const store={
    async getContextPacket(){return packet;},async putContextPacket(){},async invalidateContextPacket(){},
    async listQueues(){return{};},async listHistory(){return[];},
    async addInteraction(x){savedRoute=x.route;return{id:'i1'};},
    async addQueueItem(){return{id:'q1',status:'pending'};}
  };
  const router={async route(){return {route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Safe scoped proposal',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Mary Kate / AI operating system',field:'Next bounded action',value:'Run the production vertical slice.'}};}};
  const service=createControlService({github:{},router,store});
  const result=await service.capture('For Mary Kate, update the next bounded action',{requiredFactKeys:['next-bounded-action']});
  assert.equal(result.queue_item.id,'q1');
  assert.equal(savedRoute.proposal.section,'Mary Kate / AI operating system');
});
