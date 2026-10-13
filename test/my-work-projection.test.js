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
  assert.equal(result.version,'mary-kate.my-work.v2');
  assert.match(maryKate.what,/private system/i);
  assert.match(maryKate.works,/does not prove/i);
  assert.match(maryKate.blocked_or_unverified,/unverified/i);
  assert.equal(maryKate.next,'Run one limited non-production preservation check.');
  assert.equal(maryKate.freshness,'reconciled');
  assert.doesNotMatch(maryKate.next,/save key/i);
  assert.match(result.work[1].what,/video/i);
  assert.doesNotMatch(result.work[1].next,/abcdef|96\/96/i);
  assert.equal(result.work[2].blocked_or_unverified,'Missing source media.');
  assert.deepEqual(result.approved_deferred.map(item=>item.label),['provider failover','private draft rendering']);
});

test('contradictory newer state never becomes a confident next action',()=>{
  const contradictory=active.replace('Run one limited non-production preservation check.','Run the preservation test.').replace('**Historical checkpoint:** Save Key work was previously proposed.','**2026-10-12 Mary Kate checkpoint:** Another current checkpoint.').replace('Implement Save Key.\n### Mary Kate','Create a different preservation test.\n### Mary Kate');
  const result=buildMyWorkProjection({activeWork:contradictory,activeSha:'a'});
  assert.equal(result.work[0].next,'The latest next step needs verification.');
  assert.equal(result.work[0].freshness,'needs_verification');
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
