import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_ROUTE_TOOL,RoutingContractError,createWorkersAiRoutingAdapter} from '../src/control/adapters.js';

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
