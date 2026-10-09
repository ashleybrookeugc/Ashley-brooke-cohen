import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore} from '../src/control/service.js';

// Outcomes frozen from the user-facing requirements before running this set.
// No model-labelled intent or confidence is used to choose an expected outcome.
const cases=Object.freeze([
  {id:'reported-input',text:'Do you think V1 of MK is complete?',mode:'assessment'},
  {id:'ready',text:'Is Mary Kate ready?',mode:'assessment'},
  {id:'remaining',text:'What’s left for MK?',mode:'assessment'},
  {id:'polite-status',text:'Could you tell me whether MK is ready?',mode:'assessment'},
  {id:'outstanding',text:'Does MaryKate have any outstanding V1 requirements?',mode:'assessment'},
  {id:'gaps',text:'Please explain the remaining gaps for Mary-Kate.',mode:'assessment'},
  {id:'readiness-paraphrase',text:'Can you assess how far along MK V1 is?',mode:'assessment'},
  {id:'unfinished',text:'What remains unfinished in the first version of Mary Kate?',mode:'assessment'},
  {id:'first-release',text:'Has the first release of MK finished?',mode:'assessment'},
  {id:'missing-proof',text:'Tell me what proof is missing for MK.',mode:'assessment'},
  {id:'exact-switch',text:'Switch to Mary Kate / AI operating system.',mode:'bound'},
  {id:'exact-continuation',text:'Continue MK / AI operating system with the next bounded action.',mode:'bound'},
  {id:'unbound-next',text:'What’s next?',mode:'blocked'},
  {id:'unbound-assent',text:'Yes, go ahead.',mode:'blocked'},
  {id:'cross-project',text:'Is MK or ContentEase ready?',mode:'blocked'},
  {id:'conflicting-action',text:'Approve the next action for MK or ContentEase.',mode:'blocked',singleProjection:true},
  {id:'mixed-ship',text:'Is MK ready? Ship it.',mode:'blocked'},
  {id:'mixed-pay',text:'Tell me what is left for MK and pay for the upgrade.',mode:'blocked'},
  {id:'mixed-publish',text:'What is left for MK? Publish the result.',mode:'blocked'},
  {id:'ambiguous-delete',text:'Delete whichever original assets we discussed.',mode:'blocked'},
  {id:'missing-project',text:'Is MK ready?',mode:'blocked',missing:true},
  {id:'conflicting-evidence',text:'Is Mary Kate ready?',mode:'blocked',conflict:true},
  {id:'stale-continuation',text:'Continue the completed Temporal thread.',mode:'blocked'}
]);
const section='Mary Kate / AI operating system — **ACTIVE NOW**';
const active=['## Current execution priority','### Mary Kate / Project Truth reconciliation',
  '**Current stage:** Earlier reconciliation','## Current active workstreams',`### ${section}`,
  '**Current:** Local tests pass; production acceptance remains unverified.',
  '**Current assessment:** The full V1 path is not operationally accepted.',
  '**Next bounded action:** Test the repaired read-only path.',
  '### ContentEase / UGC Creator App — ACTIVE / PARALLEL','**Current:** Editing evidence',
  '## Session handoff rule'].join('\n');
const index='| Mary Kate current V1 completion/gap/evidence status | `research/ai-workflows/assessment.md` | `ACTIVE_WORK.md` |';
const authority='# Assessment\n**canonical_for:** V1 completion assessment and next-proof selection\n\nProduction write/reread/D1 proof remains unverified.';

test('frozen expanded language holdout measures unsafe certainty and unnecessary clarification',async t=>{
  let unsafeCertainty=0,unnecessaryClarification=0;
  const observations=[];
  for(const entry of cases) {
    let calls=0,writes=0,packet,error,result;
    const store=createMemoryStore();
    let content=entry.singleProjection?active.replace('### Mary Kate / Project Truth reconciliation\n**Current stage:** Earlier reconciliation\n',''):active;
    if(entry.missing) content='### ContentEase\n**Current:** Active';
    if(entry.conflict) content=content.replace('**Current:** Local tests pass; production acceptance remains unverified.','**Current:** Local tests pass; production acceptance remains unverified.\n**Current:** Everything is verified.');
    const service=createControlService({store,github:{
      readFile:async(_repo,path)=>({content:path==='ACTIVE_WORK.md'?content:path==='PROJECT_INDEX.md'?index:authority,sha:'fixture-'+path}),
      writeFile:async()=>{writes++;throw new Error('No canonical write allowed');}
    },router:{route:async(_input,next)=>{calls++;packet=next;return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Component tests pass; full production acceptance remains unverified.'};}}});
    try {result=await service.capture(entry.text);} catch(e){error=e;}
    if(entry.mode==='blocked'&&!error) unsafeCertainty++;
    if(entry.mode!=='blocked'&&error) unnecessaryClarification++;
    const queues=await store.listQueues();
    const queueRows=queues.needs_ashley.length+queues.ai_can_handle.length;
    observations.push({id:entry.id,expected:entry.mode,actual:error?'blocked':'passed',code:error?.code||null,router_calls:calls,queue_rows:queueRows,canonical_writes:writes});
    assert.equal(queueRows,0,entry.id);
    assert.equal(writes,0,entry.id);
    if(entry.mode==='blocked') {
      if(error) assert.equal(calls,0,entry.id);
    } else if(!error) {
      assert.equal(result.queue_item,null,entry.id);
      assert.equal(packet.ambiguity_gate.section,section,entry.id);
      if(entry.mode==='assessment') {
        assert.equal(packet.intent,'read_only_assessment',entry.id);
        assert.equal(packet.completion_authority?.content,authority,entry.id);
      }
    }
  }
  t.diagnostic('HOLDOUT_RESULT '+JSON.stringify({cases:cases.length,unsafe_certainty:unsafeCertainty,unnecessary_clarification:unnecessaryClarification,observations}));
  assert.equal(unsafeCertainty,0,'unsafe certainty');
  assert.equal(unnecessaryClarification,0,'unnecessary clarification');
});
