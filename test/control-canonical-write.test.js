import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore} from '../src/control/service.js';

const initial=['## Current active workstreams','','### UGC Creator App','**Current stage:** active  ','**Current objective:** Keep context  ','**Next bounded action:** Test cache  ','','## Session handoff rule',''].join('\n');
const proposal={target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'UGC Creator App',field:'Next bounded action',value:'Use verified GitHub write receipts'};
const router={route:async()=>({route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Use verified GitHub write receipts',proposal:structuredClone(proposal)})};

function fixture({writeError,readbackError}={}) {
  let content=initial,sha='base',writes=0,failReadback=false;
  const github={
    async readFile(){if(failReadback&&readbackError)throw readbackError;return{content,sha};},
    async writeFile(_repo,_path,next,expected){writes++;assert.equal(expected,sha);if(writeError)throw writeError;content=next;sha='written';failReadback=true;return{commit_sha:'commit-1',content_sha:'written'};},
    async findFileCommit(_repo,_path,fileSha){return fileSha==='written'?'commit-1':null;}
  };
  const store=createMemoryStore({now:()=>new Date('2026-10-02T00:00:00Z').toISOString()});
  const app=createControlService({github,router,store,now:()=>Date.parse('2026-10-02T00:00:00Z')});
  return {app,store,github,get writes(){return writes},get content(){return content},set readbackFailure(v){failReadback=v;},changeCanonical(next){content=next;sha='newer';}};
}
async function pending(f){await f.app.capture('Advance UGC Creator App');return (await f.store.listQueues()).ai_can_handle[0];}

test('same operation and payload recover from GitHub marker without a second mutation',async()=>{
  const f=fixture();const item=await pending(f);const first=await f.app.approve(item.id);assert.equal(first.receipt.status,'verified');assert.equal(f.writes,1);
  const second=await f.app.approve(item.id);assert.equal(second.receipt.status,'verified');assert.equal(second.receipt.recovered,true);assert.equal(f.writes,1);assert.match(second.message,/did not write it again/);
});

test('same operation ID with changed payload fails closed before another write',async()=>{
  const f=fixture();const item=await pending(f);await f.app.approve(item.id);item.proposal.value='Different requested change';
  await assert.rejects(()=>f.app.approve(item.id),error=>error.code==='operation_identity_conflict');assert.equal(f.writes,1);
});

test('stale GitHub SHA conflict is surfaced without a verified receipt',async()=>{
  const error=Object.assign(new Error('GitHub rejected the write because the canonical file changed first. Mary Kate did not overwrite it.'),{code:'canonical_version_conflict',status:409});
  const f=fixture({writeError:error});const item=await pending(f);
  await assert.rejects(()=>f.app.approve(item.id),error=>error.code==='canonical_version_conflict');assert.equal(f.writes,1);assert.equal((await f.store.listHistory(1))[0].outcome_status,'pending');
});

test('write without fresh reread cannot become a verified success receipt',async()=>{
  const f=fixture({readbackError:new Error('network unavailable')});const item=await pending(f);
  await assert.rejects(()=>f.app.approve(item.id),/canonical read-back verification/);const history=await f.store.listHistory(1);assert.equal(history[0].outcome_status,'failed');assert.equal(history[0].receipt.status,'failed');
});

test('an operational receipt alone cannot cause a canonical-success claim',async()=>{
  const f=fixture();const item=await pending(f);await f.store.resolveQueueItem(item.id,'approved','old receipt',{status:'verified'});
  await assert.rejects(()=>f.app.approve(item.id),error=>error.code==='canonical_receipt_not_verified');assert.equal(f.writes,0);
});

test('approval cannot overwrite canonical state changed since proposal review',async()=>{
  const f=fixture();const item=await pending(f);
  const newer=initial.replace('Test cache','Preserve the newly reviewed action');f.changeCanonical(newer);
  await assert.rejects(f.app.approve(item.id),error=>error.code==='canonical_review_stale');
  assert.equal(f.content,newer);assert.equal(f.writes,0);assert.equal(item.status,'pending');
});

test('side-idea approvals bind their own target version, not the active-work packet',async()=>{
  let side='# Side ideas\n',sideSha='side-base',writes=0;
  const store=createMemoryStore();
  const app=createControlService({store,github:{readFile:async(_repo,path)=>path==='ACTIVE_WORK.md'?{content:initial,sha:'active-base'}:{content:side,sha:sideSha},writeFile:async(_repo,_path,next)=>{writes++;side=next;sideSha='written';return{commit_sha:'fixture-commit',content_sha:sideSha};}},router:{route:async()=>({route_kind:'side_idea',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Pending idea',proposal:{target_repo:proposal.target_repo,target_path:'SIDE_IDEAS.md',operation:'append_side_idea',title:'Fixture',body:'Synthetic idea',scope:'testing'}})}});
  const result=await app.capture('A synthetic idea for later');
  side='# Side ideas\nA newer canonical entry\n';sideSha='side-newer';
  await assert.rejects(app.approve(result.queue_item.id),error=>error.code==='canonical_review_stale');
  assert.equal(writes,0);assert.match(side,/newer canonical entry/);
});

test('legacy pending approval without verified review version fails closed',async()=>{
  const f=fixture();const item=await pending(f);delete item.proposal.reviewed_sha;
  await assert.rejects(f.app.approve(item.id),error=>error.code==='canonical_review_missing');assert.equal(f.writes,0);
});
