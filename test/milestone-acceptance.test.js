import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore} from '../src/control/service.js';
import {projectRoutingOutcome} from '../src/control/outcome.js';
import {readMilestoneAuthority,checkMilestoneAdvancement} from '../src/control/milestone-acceptance.js';

const sha=char=>char.repeat(40);
function fixture() {
  const data={head:sha('a'),product:sha('c'),roadmap:sha('d'),contract:sha('e'),registry:sha('f'),criteria:{'check-a':1},resume:'stage-one',fail:false,racing:false};
  const github={
    async readMainRevision(repo) {
      if(data.fail) throw new Error('unavailable');
      return repo.endsWith('research-vault')?data.head:data.product;
    },
    async readFile(repo,path,revision) {
      if(path==='ACTIVE_WORK.md') return {sha:sha('8'),content:'## Current active workstreams\n### Mary Kate / AI operating system — ACTIVE NOW\n**Current stage:** Step 1\n'};
      assert.equal(revision,repo.endsWith('research-vault')?data.head:data.product);
      if(path.endsWith('REGISTRY.json')) {
        if(data.racing) data.head=sha('9');
        return {sha:data.registry,content:JSON.stringify({milestone_acceptance:{1:{resume_id:data.resume,criteria:data.criteria,completion_receipt:data.receipt}}})};
      }
      if(path.endsWith('SEQUENCE.md')) return {sha:data.roadmap,content:'Roadmap'};
      if(path.endsWith('CONTRACT.md')) return {sha:data.contract,content:'Contract'};
      assert.ok(path.endsWith('CONTROL_PLANE_TEST_REGISTRY.md'));
      return {sha:sha('0'),content:'Product tests'};
    },
  };
  const check=receipt=>checkMilestoneAdvancement({github,milestone:'1',receipt});
  const pin=()=>readMilestoneAuthority(github,'1');
  return {data,check,pin,github};
}
const passed=version=>({result:'passed',version,reference:'isolated verified test receipt'});

test('new cross-session criteria block the old pass until affected evidence is verified',async()=>{
  const {data,check,pin}=fixture();
  const receipt={authority:await pin(),evidence:{'check-a':passed(1)}};
  assert.equal((await check(receipt)).allowed,true);
  data.criteria={'check-a':1,'check-b':1};
  data.registry=sha('1');
  data.head=sha('2');
  const blocked=await check(receipt);
  assert.equal(blocked.allowed,false);
  assert.deepEqual(blocked.missing,['check-b']);
  assert.equal(receipt.evidence['check-a'].result,'passed');
  assert.equal((await check({...receipt,authority:await pin()})).allowed,false);
  const revalidated=await check({authority:await pin(),evidence:{...receipt.evidence,'check-b':passed(1)}});
  assert.equal(revalidated.allowed,true);
  data.criteria['check-b']=2;
  assert.deepEqual((await check({authority:revalidated.current,evidence:{...receipt.evidence,'check-b':passed(1)}})).missing,['check-b']);
});

test('changes to unrelated files or registry entries permit unchanged scoped receipts',async()=>{
  const {data,check,pin}=fixture();
  const receipt={authority:await pin(),evidence:{'check-a':passed(1)}};
  data.head=sha('1');
  data.product=sha('2');
  data.registry=sha('3');
  assert.equal((await check(receipt)).allowed,true);
  data.roadmap=sha('4');
  const changed=await check(receipt);
  assert.equal(changed.allowed,false);
  assert.deepEqual(changed.changed_authorities,['roadmap']);
});

test('unavailable, moving authorities and stale resume references block advancement',async()=>{
  const {data,check,pin}=fixture();
  const receipt={authority:await pin(),evidence:{'check-a':passed(1)}};
  data.resume='new-resume';
  assert.equal((await check(receipt)).code,'stale_resume');
  data.fail=true;
  assert.equal((await check(receipt)).code,'authority_unavailable');
  data.fail=false;
  data.racing=true;
  assert.equal((await check(receipt)).code,'authority_unavailable');
});


test('normal chat rechecks the canonical roadmap on resume and completion across sessions',async()=>{
  const {data,pin,github}=fixture();
  data.receipt={authority:await pin(),evidence:{'check-a':passed(1)}};
  let models=0,writes=0;
  github.writeFile=async()=>{writes++;};
  const store=createMemoryStore();
  const core=createControlService({github,store,router:{route:async()=>{models++;throw new Error('Unexpected model dispatch');}}});
  const first=await core.capture('Is Mary Kate step 1 complete?',{conversationId:'session-one'});
  assert.match(first.plain_summary,/verified evidence/);
  data.criteria={'check-a':1,'check-b':1};
  data.registry=sha('1');
  data.head=sha('2');
  const resumed=await core.capture('Continue with that prompt execution',{conversationId:'session-two',
    conversationHistory:[{role:'user',text:'Please resume Mary Kate Step 1'}]});
  assert.equal(projectRoutingOutcome(resumed).user_view.status,'blocked');
  assert.match(resumed.plain_summary,/check b/);
  const completed=await core.capture('Mark Mary Kate milestone 1 complete. Check B already passed.',{conversationId:'session-two'});
  assert.equal(projectRoutingOutcome(completed).user_view.status,'blocked');
  assert.deepEqual(completed.retrieval_trace.stages.find(stage=>stage.stage==='milestone_freshness').missing,['check-b']);
  assert.equal(data.receipt.evidence['check-a'].result,'passed');
  data.receipt={authority:await pin(),evidence:{...data.receipt.evidence,'check-b':passed(1)}};
  assert.match((await core.capture('Is Mary Kate milestone 1 finished?')).plain_summary,/verified evidence/);
  data.fail=true;
  assert.match((await core.capture('Resume Mary Kate step 1')).plain_summary,/couldn’t verify/);
  assert.equal((await store.listHistory(10)).length,5);
  assert.equal(models,0);
  assert.equal(writes,0);
});

test('ordinary approvals cannot save a Mary Kate stage change from an old or model-created proposal',async()=>{
  const {github}=fixture();
  const store=createMemoryStore();
  const proposal={target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',
    section:'Mary Kate / AI operating system — ACTIVE NOW',field:'Current stage',value:'Done',reviewed_sha:sha('8')};
  github.writeFile=async()=>assert.fail('Stage changed outside its authority');
  const core=createControlService({github,store,router:{route:async()=>({route_kind:'state_update',responsibility:'needs_ashley',confidence:'high',plain_summary:'Set stage',proposal})}});
  await assert.rejects(core.capture('Update the current stage for Mary Kate'),{code:'milestone_record_required'});
  assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
  const old=await store.addQueueItem({interaction_id:'old',responsibility:'needs_ashley',proposal});
  await assert.rejects(core.approve(old.id),{code:'milestone_record_required'});
  assert.equal((await store.getQueueItem(old.id)).status,'pending');
});
