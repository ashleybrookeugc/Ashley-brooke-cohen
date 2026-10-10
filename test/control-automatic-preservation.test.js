import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore,verifyWorkerHandoff} from '../src/control/service.js';

const repo='ashleybrookeugc/research-vault';
const section='Video analyzer — ACTIVE';
const oldPriority='No source-priority rule has been established.';
const decision='Prioritize accurate source timestamps over processing speed.';
const active=priority=>['## Current active workstreams','',`### ${section}`,`**Next decision:** ${priority}  `,'','## Session handoff rule',''].join('\n');
const index='| Video analyzer source-priority decision | `ACTIVE_WORK.md` | isolated acceptance route |\n';
const route=(overrides={})=>({route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'The source-priority decision is ready for verified preservation.',proposal:{target_repo:repo,target_path:'ACTIVE_WORK.md',operation:'replace_field',section,field:'Next decision',value:decision,expected_current_value:oldPriority,index_route:'Video analyzer source-priority decision'},...overrides});

function fixture({initial=active(oldPriority),indexed=true,writeFailure=false}={}) {
  let content=initial,sha='active-1',writes=0,sequence=0;
  const github={
    async readFile(_repo,path) {
      if(path==='PROJECT_INDEX.md') return {content:indexed?index:'# no video route\n',sha:'index-1'};
      assert.equal(path,'ACTIVE_WORK.md');
      return {content,sha};
    },
    async writeFile(_repo,path,next,expected) {
      assert.equal(path,'ACTIVE_WORK.md');assert.equal(expected,sha);writes++;
      if(writeFailure) { const error=new Error('Fixture GitHub write failed');error.code='github_request_failed';throw error; }
      content=next;sha='active-'+(++sequence+1);return {commit_sha:'fixture-commit-'+writes,content_sha:sha};
    },
    async findFileCommit(){return 'fixture-existing-commit';}
  };
  const store=createMemoryStore({now:()=>new Date('2026-10-10T00:00:00.000Z').toISOString()});
  const router={route:async()=>route()};
  const service=createControlService({github,router,store,now:()=>Date.parse('2026-10-10T00:00:00.000Z')});
  return {service,store,github,setRoute:next=>router.route=async()=>next,get writes(){return writes},get content(){return content}};
}

test('automatic conversation preservation writes, rereads, indexes, and gives a fresh worker the decision',async()=>{
  const f=fixture();
  const saved=await f.service.capture('The video analyzer should prioritize accurate source timestamps over processing speed.',{automaticPreservation:true});
  assert.equal(saved.preservation.status,'verified');
  assert.equal(saved.preservation.receipt.status,'verified');
  assert.equal(saved.preservation.receipt.index.status,'verified');
  assert.equal(f.writes,1);assert.match(f.content,/accurate source timestamps over processing speed/);

  // A new service and store deliberately receive no original conversation.
  const fresh=createControlService({github:f.github,router:{route:async()=>{throw new Error('handoff retrieval must not route the original turn');}},store:createMemoryStore()});
  const current=await fresh.state({refresh:true});
  const retrieved=current.projects.find(project=>project.name===section)['Next decision'];
  assert.equal(retrieved,decision);
  const handoff=verifyWorkerHandoff({task_id:'fixture-video-priority',original_request:'The video analyzer should prioritize accurate source timestamps over processing speed.',scoped_task:'Apply the persisted video-analyzer source-priority decision.',permissions:'read Project Truth only',authority:current.source,expected_application:decision},{authority_sha:current.source.sha,applied_decision:retrieved});
  assert.equal(handoff.status,'verified');
});

test('already canonical information produces a verified no-op rather than a duplicate commit',async()=>{
  const f=fixture({initial:active(decision)});
  const result=await f.service.capture('Accurate source timestamps matter more than processing speed for the video analyzer.',{automaticPreservation:true});
  assert.equal(result.preservation.status,'already_canonical');assert.equal(result.preservation.receipt.already_canonical,true);assert.equal(f.writes,0);
});

test('conflicting canonical information fails closed and retains a failed preservation receipt',async()=>{
  const f=fixture({initial:active('Prioritize processing speed over source timestamp accuracy.')});
  const result=await f.service.capture('The video analyzer should prioritize accurate source timestamps over processing speed.',{automaticPreservation:true});
  assert.equal(result.preservation.status,'failed');assert.equal(result.preservation.receipt.code,'canonical_conflict');assert.equal(f.writes,0);
  assert.equal((await f.store.listHistory(1))[0].receipt.status,'failed');
});

test('a missing Project Truth index route blocks automatic preservation before a write',async()=>{
  const f=fixture({indexed:false});
  const result=await f.service.capture('The video analyzer should prioritize accurate source timestamps over processing speed.',{automaticPreservation:true});
  assert.equal(result.preservation.status,'failed');assert.equal(result.preservation.receipt.code,'canonical_index_route_missing');assert.equal(f.writes,0);
});

test('a failed GitHub write is a failed receipt, never a saved claim',async()=>{
  const f=fixture({writeFailure:true});
  const result=await f.service.capture('The video analyzer should prioritize accurate source timestamps over processing speed.',{automaticPreservation:true});
  assert.equal(result.preservation.status,'failed');assert.equal(result.preservation.receipt.code,'github_request_failed');assert.equal((await f.store.listHistory(1))[0].receipt.status,'failed');assert.equal(f.writes,1);
});

test('a consequential change needing approval remains recoverable pending context',async()=>{
  const f=fixture();f.setRoute(route({route_kind:'decision',responsibility:'needs_ashley'}));
  const result=await f.service.capture('Adopt a new external provider and retire the current analyzer.',{automaticPreservation:true});
  assert.equal(result.preservation.status,'pending_approval');assert.equal(f.writes,0);assert.equal((await f.store.listQueues()).needs_ashley.length,1);
});

test('temporary conversation makes no canonical commit',async()=>{
  const f=fixture();f.setRoute({route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Small talk; no durable change.'});
  const result=await f.service.capture('I am stepping away to make tea.',{automaticPreservation:true});
  assert.equal(result.preservation.status,'not_material');assert.equal(f.writes,0);assert.equal((await f.store.listQueues()).ai_can_handle.length,0);
});

test('a handoff that drops the original decision cannot complete',()=>{
  const receipt=verifyWorkerHandoff({task_id:'fixture-video-priority',original_request:'The video analyzer should prioritize accurate source timestamps over processing speed.',scoped_task:'Apply the persisted video-analyzer source-priority decision.',permissions:'read Project Truth only',authority:{repo,path:'ACTIVE_WORK.md',sha:'active-2'},expected_application:decision},{authority_sha:'active-2',applied_decision:'Prioritize processing speed.'});
  assert.equal(receipt.status,'failed');assert.match(receipt.reason,/did not demonstrate application/);
});
