import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkersAiRoutingAdapter} from '../src/control/adapters.js';
import {createControlService,createMemoryStore,verifyWorkerHandoff} from '../src/control/service.js';

const repo='ashleybrookeugc/research-vault';
const section='Video analyzer — ACTIVE';
const original='The video analyzer should prioritize accurate source timestamps over processing speed.';
const old='No source-priority rule has been established.';
const decision='Prioritize accurate source timestamps over processing speed.';
const active=(value=old,extra='')=>['## Current active workstreams','',`### ${section}`,`**Next decision:** ${value}  `,extra,'## Session handoff rule',''].join('\n');
const indexed='| Video analyzer source-priority decision | `ACTIVE_WORK.md` | fixture route |\n';
const proposal=(overrides={})=>({target_repo:repo,target_path:'ACTIVE_WORK.md',operation:'replace_field',section,field:'Next decision',value:decision,...overrides});
const valid=(overrides={})=>({route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Preserve the video analyzer priority.',proposal:proposal(),...overrides});

function fixture({output=valid(),content=active(),index=indexed,staleOnReview=false}={}) {
  let canonical=content,sha='active-1',reads=0,writes=0,request;
  const github={
    async readFile(_repo,path) {
      if(path==='PROJECT_INDEX.md') return {content:index,sha:'index-1'};
      assert.equal(path,'ACTIVE_WORK.md');
      reads++;
      if(staleOnReview&&reads===2) { canonical=active('Prioritize processing speed.');sha='active-2'; }
      return {content:canonical,sha};
    },
    async writeFile(_repo,_path,next,expected) { assert.equal(expected,sha);writes++;canonical=next;sha='written';return {commit_sha:'fixture-'+writes,content_sha:sha}; },
    async findFileCommit(){return 'fixture-existing';}
  };
  const router=createWorkersAiRoutingAdapter({AI:{run:async(_model,input)=>{request=input;return {tool_calls:[{name:'submit_control_route',arguments:structuredClone(output)}]};}}});
  const store=createMemoryStore();
  const service=createControlService({github,router,store});
  return {service,store,github,get request(){return request},get writes(){return writes},get content(){return canonical}};
}

test('recorded Workers AI tool output invokes automatic preservation with deterministic authority bindings',async()=>{
  const f=fixture();
  const result=await f.service.capture(original,{automaticPreservation:true});
  assert.equal(result.preservation.status,'verified');assert.equal(f.writes,1);
  assert.equal(result.preservation.receipt.index.route,'Video analyzer source-priority decision');
  const history=await f.store.listHistory(1),saved=history[0].route.proposal;
  assert.equal(saved.expected_current_value,old);assert.equal(saved.index_route,undefined);assert.equal(saved.authority_binding.source.sha,'active-1');
  assert.equal(f.request.tools[0].parameters.properties.proposal.additionalProperties,false);
  assert.equal(f.request.tools[0].parameters.properties.proposal.properties.expected_current_value,undefined);
  assert.equal(f.request.tools[0].parameters.properties.proposal.properties.index_route,undefined);
  const fresh=createControlService({github:f.github,router:{route:async()=>{throw new Error('fresh retrieval must not replay the original turn');}},store:createMemoryStore()});
  const state=await fresh.state({refresh:true});const applied=state.projects.find(x=>x.name===section)['Next decision'];
  assert.equal(verifyWorkerHandoff({task_id:'workers-ai-fixture',original_request:original,scoped_task:'Apply the preserved source-priority decision.',permissions:'read Project Truth only',authority:state.source,expected_application:decision},{authority_sha:state.source.sha,applied_decision:applied}).status,'verified');
});

test('Workers AI automatic-preservation negative controls fail closed',async t=>{
  const cases=[
    ['missing index route',{index:'# no route\n'},'canonical_index_route_missing'],
    ['stale expected-current binding',{output:valid({proposal:proposal({expected_current_value:'Model-invented stale value.'})}),staleOnReview:true},'canonical_review_stale'],
    ['conflicting Project Truth authority',{content:active(old,`**Next decision:** A conflicting saved priority.  `)},'canonical_conflict'],
    ['valid-looking proposal without source support',{output:valid({proposal:proposal({value:'Adopt an unrelated external provider.'})})},'canonical_evidence_missing'],
  ];
  for(const [name,options,code] of cases) await t.test(name,async()=>{
    const f=fixture(options);const result=await f.service.capture(original,{automaticPreservation:true});
    assert.equal(result.preservation.status,'failed');assert.equal(result.preservation.receipt.code,code);assert.equal(f.writes,0);
  });
});

test('invalid provider routes, invented approval, duplicate, and temporary turns keep their existing safe outcomes',async t=>{
  await t.test('incorrect canonical destination is rejected by the real adapter',async()=>{
    const f=fixture({output:valid({proposal:proposal({target_repo:'fixture/other'})})});
    await assert.rejects(()=>f.service.capture(original,{automaticPreservation:true}),error=>error.code==='routing_contract_invalid');assert.equal(f.writes,0);
  });
  await t.test('model cannot self-authorize a decision',async()=>{
    const f=fixture({output:valid({route_kind:'decision',responsibility:'ai_can_handle'})});
    await assert.rejects(()=>f.service.capture(original,{automaticPreservation:true}),error=>error.code==='routing_contract_invalid');assert.equal(f.writes,0);
  });
  await t.test('invalid field is rejected by the real adapter',async()=>{
    const f=fixture({output:valid({proposal:proposal({field:'Approval status'})})});
    await assert.rejects(()=>f.service.capture(original,{automaticPreservation:true}),error=>error.code==='routing_contract_invalid');assert.equal(f.writes,0);
  });
  await t.test('duplicate is a verified no-op',async()=>{
    const f=fixture({content:active(decision)});const result=await f.service.capture(original,{automaticPreservation:true});assert.equal(result.preservation.status,'already_canonical');assert.equal(f.writes,0);
  });
  await t.test('temporary conversation creates no commit',async()=>{
    const f=fixture({output:{route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'No durable change.'}});const result=await f.service.capture('I am making tea.',{automaticPreservation:true});assert.equal(result.preservation.status,'not_material');assert.equal(f.writes,0);
  });
});
