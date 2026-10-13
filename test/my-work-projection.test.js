import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMyWorkProjection} from '../src/control/my-work.js';
import {createControlService,createMemoryStore} from '../src/control/service.js';

const active=`# Active Work
## Current active workstreams
### Mary Kate — **ACTIVE NOW**
**Authority:** control.md
**Current:** Building the smallest dashboard.
**Next bounded action:** Review the isolated branch.
### Portfolio — **BLOCKED**
**Current:** Evidence review.
**Blocked by:** Missing source media.
**Next when unblocked:** Review the media.
## Session handoff rule
## Return checkpoint
**Deferred, approved and already routed:** provider failover, private draft rendering, MP4 delivery and optional editable project.
`;
const ideas=`# Side Ideas
## Promoted
### AI-routed dashboard
**Status:** promoted to active design
Canonical design: control.md.
## Open ideas
### Not approved
**Status:** research-only
`;

test('My Work projection derives states, blockers, next actions and approved deferred work',()=>{
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a'.repeat(40),sideIdeas:ideas,sideIdeasSha:'b'.repeat(40)});
  assert.equal(result.read_only,true);
  assert.deepEqual(result.work.map(item=>item.status),['ACTIVE NOW','BLOCKED']);
  assert.equal(result.work[1].blocker,'Missing source media.');
  assert.equal(result.work[1].next,'Review the media.');
  assert.deepEqual(result.approved_deferred.map(item=>item.label),['provider failover','private draft rendering','MP4 delivery and optional editable project']);
  assert.deepEqual(result.promoted.map(item=>item.label),['AI-routed dashboard']);
});

test('only mechanically verified canonical receipts appear as verified completion',()=>{
  const valid={plain_summary:'Update confirmed',receipt:{status:'verified',commit_sha:'c'.repeat(40),target:{repo:'x',path:'y'},verification:{status:'verified',verified_at:'2026-10-13T20:00:00Z'}}};
  const claimed={plain_summary:'Worker says done',receipt:{status:'verified',commit_sha:'d'.repeat(40),verification:{status:'mismatch'}}};
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a',sideIdeas:ideas,sideIdeasSha:'b',history:[valid,claimed]});
  assert.deepEqual(result.verified_completion.map(item=>item.label),['Update confirmed']);
  assert.equal(result.verified_completion[0].scope,'Canonical update');
});

test('read-only projection rereads GitHub sources and reflects their new SHAs',async()=>{
  let version=0;
  const github={async readFile(repo,path){return {content:path==='ACTIVE_WORK.md'?active.replace('Building the smallest dashboard.',version?'Ready for review.':'Building the smallest dashboard.'):ideas,sha:String(++version).padStart(40,'0')}}};
  const service=createControlService({github,store:createMemoryStore(),router:{async route(){throw Error('not used')}},now:()=>0});
  const first=await service.myWork();
  const second=await service.myWork();
  assert.equal(first.work[0].summary,'Building the smallest dashboard.');
  assert.equal(second.work[0].summary,'Ready for review.');
  assert.notEqual(first.sources[0].sha,second.sources[0].sha);
});
