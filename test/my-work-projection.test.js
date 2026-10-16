import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMyWorkProjection} from '../src/control/my-work.js';
import {createControlService,createMemoryStore} from '../src/control/service.js';

const active=`# Active Work
## Current execution priority
**2026-10-13 automatic-preservation checkpoint:** Mary Kate preservation work passed a bounded check. **Next bounded action:** Run one limited non-production preservation check.
**Historical checkpoint:** Save Key work was previously proposed. **Next bounded action:** Implement Save Key.
## Current active workstreams
### Mary Kate / AI operating system — **ACTIVE NOW**
**Authority:** control.md
**Current:** A safe Project Truth read gate passed, but a complete phone experience is not proven.
**Last verified work:** Today: the Active Work record was checked and corrected.
**Next bounded action:** Implement Save Key.
### Shared video-understanding / evidence engine — **ACTIVE / PARALLEL**
**Current:** An analyzer implementation is available, but real phone acceptance is unverified.
**Next:** Read branch abcdef0123456789 and test log 96/96.
### Portfolio — **BLOCKED**
**Current:** Evidence review.
**Blocked by:** Missing source media.
**Next when unblocked:** Review the media.
## Session handoff rule
**Deferred, approved and already routed:** provider failover, private draft rendering.
`;

test('My Work converts source records into plain-English current project cards',()=>{
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a'.repeat(40)});
  const maryKate=result.work[0];
  assert.equal(result.read_only,true);
  assert.equal(result.version,'mary-kate.command-center.v1');
  assert.match(maryKate.what,/private system/i);
  assert.match(maryKate.works,/does not.*prove/i);
  assert.match(maryKate.blocked_or_unverified,/real-world testing/i);
  assert.equal(maryKate.next,'Run one limited non-production preservation check.');
  assert.equal(maryKate.freshness,'reconciled');
  assert.match(maryKate.last_verified_work,/Active Work record/);
  assert.equal(result.today[0].last_verified_work,maryKate.last_verified_work);
  assert.doesNotMatch(maryKate.next,/save key/i);
  assert.match(result.work[1].what,/video/i);
  assert.doesNotMatch(result.work[1].next,/abcdef|96\/96/i);
  assert.match(result.work[1].next,/full recording/i);
  assert.match(result.work[2].blocked_or_unverified,/saved source videos.*not yet been reviewed/i);
  assert.match(result.work[2].next,/Review the saved performance videos/i);
  assert.equal(result.work[2].next_label,'Saved resume point');
  assert.equal(result.work[2].next_kind,'saved');
  assert.equal(result.work[2].technical.recorded_next,'Review the media.');
  assert.deepEqual(result.approved_deferred.map(item=>item.label),['provider failover','private draft rendering']);
});

test('contradictory newer state never becomes a confident next action',()=>{
  const contradictory=active.replace('**Next bounded action:** Run one limited non-production preservation check.','**Current verified next action:** Run the preservation test. **Next bounded action:** Create a different preservation test.');
  const result=buildMyWorkProjection({activeWork:contradictory,activeSha:'a'});
  assert.equal(result.work[0].next,'The current records disagree about what should happen next.');
  assert.equal(result.work[0].next_label,'Needs reconciliation');
  assert.equal(result.work[0].freshness,'needs_verification');
});

test('older priority checkpoints never promote unrelated projects into Today',()=>{
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a'});
  assert.deepEqual(result.today.map(item=>item.project),['Mary Kate / AI operating system']);
  assert.equal(result.work[1].focus,'available');
  assert.equal(result.work[2].focus,'available');
});

test('a current focus on video overrides historical cross-project mentions and unreviewed AI claims',()=>{
  const source=active.replace('## Current execution priority','## Current focus\n**Workstream:** Shared video-understanding / evidence engine\n**Do next:** Review a real video from start to finish and improve the useful edit advice.\n## Current execution priority');
  const result=buildMyWorkProjection({activeWork:source,activeSha:'a',queues:{ai_can_handle:[{id:'old',plain_summary:'Processing videos is not currently a priority.',why:'Stale model claim'}]}});
  assert.deepEqual(result.today.map(item=>item.project),['Shared video-understanding / evidence engine']);
  assert.equal(result.today[0].label,'Video processing');
  assert.equal(result.today[0].next,'Review a real video from start to finish and improve the useful edit advice.');
  assert.equal(result.projects[0].next_label,'Saved resume point');
  assert.equal(result.ai_queue[0].label,'Processing videos is not currently a priority.'); // retained as unreviewed queue history, never promoted to Today
});

test('queue approvals remain actionable while project blockers stay plain and non-mutating',()=>{
  const queues={needs_ashley:[{id:'approval-1',plain_summary:'Approve the saved wording',why:'Ashley must decide.',proposal:{plain_summary:'Replace one saved status sentence.'}}]};
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a',queues});
  const approval=result.needs_attention.find(item=>item.id==='approval-1');
  const blocker=result.needs_attention.find(item=>item.project==='Portfolio');
  assert.equal(approval.can_approve,true);
  assert.equal(approval.can_reject,true);
  assert.equal(approval.proposal_summary,'Replace one saved status sentence.');
  assert.equal(blocker.label,'Choose the first portfolio clip to review.');
  assert.equal(blocker.prompt,undefined);
  assert.equal(blocker.can_approve,undefined);
});

test('only mechanically verified canonical receipts appear as verified updates',()=>{
  const valid={plain_summary:'Update confirmed',receipt:{status:'verified',commit_sha:'c'.repeat(40),target:{repo:'x',path:'y'},verification:{status:'verified',verified_at:'2026-10-13T20:00:00Z'}}};
  const claimed={plain_summary:'Worker says done',receipt:{status:'verified',commit_sha:'d'.repeat(40),verification:{status:'mismatch'}}};
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a',history:[valid,claimed]});
  assert.deepEqual(result.verified_completion.map(item=>item.label),['Update confirmed']);
  assert.equal(result.verified_completion[0].scope,'Verified canonical update');
});

test('missing Project Truth fails closed with an understandable message',()=>{
  const result=buildMyWorkProjection({sourceStatus:'unavailable'});
  assert.equal(result.source_status,'unavailable');
  assert.match(result.message,/latest next step needs verification/i);
  assert.equal(result.work.length,0);
});

test('read-only projection rereads GitHub sources and reflects their new SHAs',async()=>{
  let version=0;
  const github={async readFile(){return {content:active.replace('A safe Project Truth read gate passed',version?'A newer check passed':'A safe Project Truth read gate passed'),sha:String(++version).padStart(40,'0')}}};
  const service=createControlService({github,store:createMemoryStore(),router:{async route(){throw Error('not used')}},now:()=>0});
  const first=await service.myWork();
  const second=await service.myWork();
  assert.notEqual(first.sources[0].sha,second.sources[0].sha);
});
