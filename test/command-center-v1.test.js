import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMyWorkProjection} from '../src/control/my-work.js';

const active=`# Active Work
## Current execution priority
**Command center continuation:** Mary Kate V1 is the current product priority. **Next bounded action:** Verify the Command Center on Ashley's phone.
## Current active workstreams
### Mary Kate / AI operating system — **ACTIVE NOW**
**Current:** The command center implementation is under review.
**Next bounded action:** Verify the Command Center on Ashley's phone.
### Portfolio — **PAUSED / RESUMABLE**
**Current:** Portfolio source review remains available to resume.
**Next:** Review source media.
### B-Paid — **WAITING FOR ASHLEY**
**Current:** One offer needs a decision.
**Waiting for:** Ashley's decision on the offer.
**Next decision:** Accept or decline the offer.
## Session handoff rule
`;

const queues={
  needs_ashley:[{id:'q1',plain_summary:'Choose whether to accept the offer',why:'A decision is required.',proposal:{}}],
  ai_can_handle:[{id:'q2',plain_summary:'Prepare the next verified summary',why:'No Ashley decision is required.',proposal:{}}]
};

test('Command Center keeps lifecycle, priority, task attention, and workers as separate dimensions',()=>{
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a'.repeat(40),queues});
  assert.equal(result.version,'mary-kate.command-center.v1');
  assert.equal(result.projects.length,3);
  assert.ok(result.projects.every(project=>project.lifecycle==='retained'));
  assert.equal(result.projects[0].focus,'today');
  assert.equal(result.projects[1].focus,'available');
  assert.equal(result.projects[2].lifecycle,'retained');
  assert.equal(result.projects[2].attention,'Ashley’s decision on the offer.');
  assert.equal(result.today[0].next,'Verify the Command Center on Ashley’s phone.');
  assert.deepEqual(result.needs_attention.map(item=>item.type),['approval_or_decision','blocker_or_decision']);
  assert.deepEqual(result.ai_queue.map(item=>item.label),['Prepare the next verified summary']);
});

test('scheduled work is truthful when no scheduling authority is connected',()=>{
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a',queues});
  assert.equal(result.schedule.status,'unavailable');
  assert.match(result.schedule.message,/Google Calendar is not connected/i);
  assert.deepEqual(result.schedule.items,[]);
});

test('all retained projects stay visible even when they are not today’s focus',()=>{
  const result=buildMyWorkProjection({activeWork:active,activeSha:'a',queues});
  assert.deepEqual(result.projects.map(project=>project.name),[
    'Mary Kate / AI operating system','Portfolio','B-Paid'
  ]);
  assert.equal(result.today.length,1);
});
