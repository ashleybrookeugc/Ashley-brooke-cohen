import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore,resolveAuthoritativeWorkstream} from '../src/control/service.js';
import {parseCanonicalFacts} from '../src/control/contracts.js';
import {isReadQuestion,selectParagraphs} from '../src/control/retrieval.js';
const active=`## Current execution priority
**Latest video proof:** The private video upload works in a desktop browser. Physical phone and semantic accuracy remain unverified.
## Current active workstreams
### Mary Kate / AI operating system — ACTIVE NOW
**Current:** Full V1 not verified.
**Next bounded action:** Test one real request.
### Shared video-understanding / evidence engine — ACTIVE / PARALLEL
**Current:** Private flow verified; phone unverified.
**Next:** Test a real phone.
### ContentEase / UGC Creator App — ACTIVE / PARALLEL
**Current:** Creator app is retained.
**Next:** Review source-backed campaigns.
### UGC / creator campaign and editing operations — ACTIVE / PARALLEL
**Current:** Other campaign work.
## Session handoff rule`;
const founder='research/ai-workflows/founder.md';
const registry='research/ai-workflows/registry.md';
const protocol='shared-capabilities/ai-workflows/SESSION_AND_FAILURE_PROTOCOL.md';
const index=`| Mary Kate founder intent, product boundaries | \`${founder}\` | |
| Mary Kate tests, acceptance cases | \`${registry}\` | |
| Known failure, regression, or previously failed approach | \`${protocol}\` | |`;
const documents={'ACTIVE_WORK.md':active,'PROJECT_INDEX.md':index,[founder]:'## Model selection and permissions\n\nAutomatic model selection is allowed. Capability selection never widens permissions.',[registry]:'## Telemetry test\n\nTelemetry local proof passed. Live worker was blocked on a config mismatch.',[protocol]:'## Prior read-only failure\n\nRead-only priority advice failed because a write-shaped output was rejected.'};
const answer={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Controlled output, not a semantic answer-quality test.'};
function setup(output=answer) {
 let packet,calls=0,writes=0;const traces=[],reads=[],store=createMemoryStore();
 const service=createControlService({store,observe:trace=>traces.push(trace),deployment:{id:'test-version'},github:{readFile:async(repo,path)=>{reads.push(path);if(!(path in documents))throw Error('Unexpected read: '+path);return {content:documents[path],sha:'blob-'+path};},writeFile:async()=>{writes++;throw Error('Forbidden');}},router:{route:async(text,p)=>{packet=p;calls++;return output;}}});
 return {service,store,reads,traces,get packet(){return packet;},get calls(){return calls;},get writes(){return writes;}};
}
test('priority next is ordinary advice, not an ambiguous cross-project Next field',async()=>{
 const run=setup();await run.service.capture('What should I prioritize next?',{contextWorkstream:'mary-kate-command-center'});
 assert.equal(run.packet.intent,'read_only_assessment');assert.equal(run.packet.ambiguity_gate.scope,'all_current_workstreams');
 assert.deepEqual(run.packet.prior_state.required_fact_keys,[]);assert.equal(run.calls,1);assert.equal(run.writes,0);
 assert.equal(run.packet.active_work.projects.length,0);
});
test('ordinary questions follow the indexed authority and carry actual selected bytes',async()=>{
 for(const [text,path,proof] of [
 ['What did we decide about automatic model selection and permissions?',founder,'never widens permissions'],
 ['What happened with the telemetry test?',registry,'config mismatch'],
 ['Why did that prior read-only question fail?',protocol,'write-shaped output'],
 ['Was the private video upload fixed?','ACTIVE_WORK.md','Physical phone']]) {
  const run=setup();await run.service.capture(text);assert.equal(run.packet.intent,'read_only_assessment',text);
  const evidence=run.packet.retrieval_evidence;assert.ok(evidence.sources.some(s=>s.source.path===path),text);
  assert.ok(JSON.stringify(evidence).includes(proof),text);
  if(path!=='ACTIVE_WORK.md')assert.ok(run.reads.includes('PROJECT_INDEX.md'),text);
  assert.deepEqual(await run.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});assert.equal(run.writes,0);
 }
});
test('common conjunctions do not select campaign work; explicit UGC correction overrides B-Paid history',async()=>{
 assert.equal(resolveAuthoritativeWorkstream('What did we decide about automatic model selection and permissions?',parseCanonicalFacts(active)).status,'unknown');
 const run=setup();await run.service.capture('Actually I meant the UGC app',{conversationHistory:[{role:'user',text:'What is happening with Shared video-understanding / evidence engine?'}]});
 assert.match(run.packet.ambiguity_gate.section,/^ContentEase/);
});
test('general read-only answers reject hostile proposals without queue or canonical writes',async()=>{
 for(const text of ['What should I do today?',"What's blocking the video analyzer?",'Was the private video upload fixed?']) {
  const run=setup({...answer,route_kind:'state_update',proposal:{target_repo:'ashleybrookeugc/research-vault',target_path:'ACTIVE_WORK.md',operation:'replace_field',section:'Shared video-understanding / evidence engine — ACTIVE / PARALLEL',field:'Current stage',value:'invented'}});
  await assert.rejects(()=>run.service.capture(text),e=>e.code==='read_only_route_violation');
  assert.deepEqual(await run.store.listQueues(),{needs_ashley:[],ai_can_handle:[]});assert.equal(run.writes,0);
 }
});
test('mixed commands remain action-bearing; ambiguity and explicit required facts still fail closed',async()=>{
 for(const text of ['What is blocked? Update the priority.','Can you publish this?','Is it ready? Ship it.','Show me the status and delete the original.','Actually I meant UGC app; deploy it.'])assert.equal(isReadQuestion(text),false,text);
 const run=setup();await assert.rejects(()=>run.service.capture('Update the priority'),e=>e.code==='ambiguous_scope');
 await assert.rejects(()=>run.service.capture('What should I prioritize next?',{requiredFactKeys:['next']}),e=>e.code==='ambiguous_scope');assert.equal(run.calls,0);
});
test('traces distinguish pre-model failure and output rejection without logging raw input or evidence',async()=>{
 const run=setup();const secret='github_pat_private_request_should_not_be_logged';
 const result=await run.service.capture('What should I do today? '+secret);
 const trace=result.retrieval_trace;assert.ok(trace.request_id);assert.equal(trace.deployment.id,'test-version');
 assert.ok(trace.stages.some(s=>s.stage==='routing_dispatch'&&s.estimated_tokens>0));
 assert.ok(trace.stages.some(s=>s.stage==='retrieval'&&s.sources[0].sha));
 assert.ok(!JSON.stringify(trace).includes(secret));assert.ok(!JSON.stringify(trace).includes('private video upload works'));
 await assert.rejects(()=>run.service.capture('Update the priority'),e=>e.retrieval_trace.stages.at(-1).first_failed_stage==='workstream');
});
test('paragraph budgets keep negation whole and never silently claim full source coverage',()=>{
 const result=selectParagraphs('## Upload\n\nUpload fixed but phone acceptance is NOT passed.\n\n'+('upload '.repeat(1000)),'upload',100);
 assert.ok(result.excerpts.some(x=>x.text.includes('NOT passed')));assert.ok(result.selected_characters<=100);assert.equal(result.truncated,true);
});
test('inherited Evidence engine title is never interpreted as a required Evidence field',async()=>{
 const content=active.replace('## Current execution priority','## Historical receipt\n**Evidence:** A historical receipt in another section.\n## Current execution priority');
 let packet;const service=createControlService({store:createMemoryStore(),github:{readFile:async()=>({content,sha:'fixture-evidence'})},router:{route:async(text,p)=>{packet=p;return answer;}}});
 await service.capture('What about that?',{conversationHistory:[{role:'user',text:"What's blocking the video analyzer?"}]});
 assert.match(packet.ambiguity_gate.section,/Shared video-understanding/);
 assert.deepEqual(packet.prior_state.required_fact_keys,[]);
});
