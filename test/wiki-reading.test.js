import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieveIndexedEvidence,authorityKind} from '../src/control/retrieval.js';
import {createControlService,createMemoryStore} from '../src/control/service.js';
const video='shared-capabilities/video-understanding/plan.md',hub='evidence/creator-workflows/README.md',leaf='evidence/creator-workflows/source.md';
const active='## Current active workstreams\n### Video analyzer — ACTIVE / PARALLEL\n**Current:** The technical flow works; creator usefulness is unverified.\n**Next:** Verify real workflow understanding.\n## Session handoff rule';
const docs={'ACTIVE_WORK.md':active,'PROJECT_INDEX.md':`| Video analyzer capability, blockers | \`${video}\` | |\n| Creator workflow findings for ContentEase | \`${hub}\` | |`,[video]:'## Video analyzer blockers\n\nTechnical upload works; complete workflow understanding is NOT proven.\n\n[Exact video acceptance](../../research/video-understanding/proof.json)', 'research/video-understanding/proof.json':JSON.stringify({status:'PARTIAL',acceptance_boundary:'Video technical PASS does NOT prove creator understanding.'}),[hub]:`# Creator workflow findings\n\n[ContentEase source language and campaign proof](source.md)\n[Network lure](https://evil.invalid/private.md)\n[Escape](../../../secrets.md)\n[Cycle](README.md)`,[leaf]:'## ContentEase workflow findings\n\nPreserve Ashley source language; creative quality does NOT prove brief completion.'};
function reader(overrides={}) {const reads=[];return {reads,readFile:async(_repo,path)=>{reads.push(path);const c={...docs,...overrides}[path];if(c==null)throw Error('private token must not escape');return{content:c,sha:'blob-'+path};}};}
test('ordinary video and creator questions walk existing indexed hubs to actual evidence',async()=>{
 for(const [question,path,proof] of [["What's blocking the video analyzer?",'research/video-understanding/proof.json','does NOT prove creator'],['Which creator workflow findings should inform ContentEase?',leaf,'does NOT prove brief']]) {
  const github=reader();const packet=await retrieveIndexedEvidence(github,question,{activeWork:{content:active,sha:'active'}});
  assert.ok(github.reads.includes('PROJECT_INDEX.md'));assert.ok(github.reads.includes(path),JSON.stringify({question,reads:github.reads,packet}));
  assert.ok(JSON.stringify(packet.sources).includes(proof));
  assert.ok(packet.sources.length<=4);assert.ok(packet.sources.reduce((n,s)=>n+s.selected_characters,0)<=16000);
  assert.ok(!github.reads.some(p=>p.includes('evil')||p==='secrets.md'));
  assert.ok(packet.sources.every(s=>s.source.sha));
 }
 assert.equal(authorityKind('Which creator workflow findings should inform ContentEase?'),'creator');
});
test('missing, failed, ambiguous and unversioned routes remain explicit rather than invented evidence',async()=>{
 for(const index of ['',docs['PROJECT_INDEX.md']+'\n'+docs['PROJECT_INDEX.md'],'| Video analyzer capability | `../../secrets.md` | |']) {
  const github=reader({'PROJECT_INDEX.md':index});const packet=await retrieveIndexedEvidence(github,'Was private video upload fixed?',{activeWork:{content:active,sha:'active'}});
  assert.ok(packet.missing.length);assert.ok(!github.reads.includes('secrets.md'));
 }
 const github=reader({[video]:null});const packet=await retrieveIndexedEvidence(github,'Was private video upload fixed?',{activeWork:{content:active,sha:'active'}});
 assert.ok(packet.missing.some(m=>m.reason==='read_unavailable'));assert.ok(!JSON.stringify(packet).includes('private token'));
});
test('a named video blocker and its follow-up reach wiki retrieval without any mutation',async()=>{
 const github=reader(),store=createMemoryStore();let calls=0,packet;
 const service=createControlService({store,github:{...github,writeFile:async()=>assert.fail('No write')},router:{route:async(_text,p)=>{calls++;packet=p;return{route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Test double; no semantic quality claim.'};}}});
 await service.capture("What's blocking the video analyzer?");
 assert.ok(packet?.retrieval_evidence.sources.some(s=>s.source.path===video));
 await service.capture('What about that?',{conversationHistory:[{role:'user',text:"What's blocking the video analyzer?"}]});
 assert.ok(packet.retrieval_evidence.sources.some(s=>s.source.path===video));
 assert.equal(calls,2);assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
 assert.equal((await service.capture('Update the priority')).route_kind,'temporary_context');
 assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
});
test('wiki context never authorizes a hostile proposal',async()=>{
 const store=createMemoryStore(),github=reader();let writes=0;
 const service=createControlService({store,github:{...github,writeFile:async()=>{writes++;}},router:{route:async()=>({route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Unsafe',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Video analyzer — ACTIVE / PARALLEL',field:'Current stage',value:'Complete'}})}});
 await assert.rejects(()=>service.capture('Which creator workflow findings should inform ContentEase?'),{code:'read_only_route_violation'});
 assert.equal(writes,0);assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
});
test('large JSON qualifications and missing anchor are explicit omissions, never sliced proof',async()=>{
 const github=reader({'research/video-understanding/proof.json':JSON.stringify({status:'PASS but '+ 'unverified '.repeat(1000),evidence:'Technical transport only'})});
 const packet=await retrieveIndexedEvidence(github,'Was private video upload fixed?',{activeWork:{content:active,sha:'active'}});
 assert.ok(packet.missing.some(x=>x.reason==='outcome_qualification_omitted'));
 const anchored=reader({'PROJECT_INDEX.md':`| Video analyzer capability | \`${video}#missing-section\` | |`});
 const missing=await retrieveIndexedEvidence(anchored,'Was private video upload fixed?',{activeWork:{content:active,sha:'active'}});
 assert.ok(missing.missing.some(x=>x.reason==='indexed_section_empty_or_missing'));
});
test('an indexed failure question can read across MK projections without weakening project/action ambiguity',async()=>{
 const protocol='shared-capabilities/ai-workflows/protocol.md';
 const content=active.replace('## Session handoff rule','### Mary Kate / AI operating system\n**Current:** Conversation incomplete.\n### Mary Kate / Project Truth reconciliation\n**Current:** Saved records present.\n### B-Paid\n**Current:** Waiting for a clip.\n## Session handoff rule');
 const github=reader({'ACTIVE_WORK.md':content,'PROJECT_INDEX.md':`| Known failure, regression | \`${protocol}\` | |`,[protocol]:'## Read-only failure\n\nRead-only answers were incorrectly made into proposals.'});
 const store=createMemoryStore();let packet;
 const service=createControlService({store,github,router:{route:async(_q,p)=>{packet=p;return{route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Provider double'};}}});
 await service.capture('Why did Mary Kate previously fail to answer my read-only questions?');
 assert.ok(packet.ambiguity_gate.scope==='indexed_authority_read_only'||/^Mary Kate \/ AI operating system/.test(packet.ambiguity_gate.section),'read-only evidence can use the resolved canonical MK projection');
 assert.ok(packet.retrieval_evidence.sources.some(s=>s.source.path===protocol));
 await assert.rejects(()=>service.capture('Is Mary Kate or B-Paid ready?'),{code:'ambiguous_scope'});
 await assert.rejects(()=>service.capture('Update Mary Kate or B-Paid'),{code:'ambiguous_scope'});
 assert.deepEqual(await store.listQueues(),{needs_ashley:[],ai_can_handle:[]});
});
