import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createControlService,createMemoryStore,controlErrorResponse} from '../../src/control/service.js';
import {createGitHubAdapter,createPolicyRoutingAdapter} from '../../src/control/adapters.js';

const frozen=JSON.parse(await readFile(new URL('./workflow-adherence-cases.json',import.meta.url),'utf8'));
const repo='ashleybrookeugc/research-vault'; // Existing canonical authority, not model-derived.
const mk='Mary Kate / AI operating system — **ACTIVE NOW**';
const single=`## Current active workstreams\n### ${mk}\n**Current:** Local proof only\n**Current assessment:** Production acceptance remains unverified\n**Next bounded action:** Read the canonical V1 evidence\n## Session handoff rule\n`;
const multiple=single.replace('## Session handoff rule','### ContentEase / UGC Creator App — ACTIVE / PARALLEL\n**Current:** Editing proof\n## Session handoff rule');
const matrixPath='research/ai-workflows/fixture-v1-assessment.md';
const index=`| Mary Kate current V1 completion/gap/evidence status | \`${matrixPath}\` | \`ACTIVE_WORK.md\` |\nSide ideas: \`SIDE_IDEAS.md\`. Founder/workflow comparison: \`shared-capabilities/ai-workflows/SECOND_BRAIN_CONTROL_PLANE.md\`.`;
const matrix='**canonical_for:** V1 completion assessment and next-proof selection\nProduction conditional-write/reread/D1 acceptance remains unverified.';
const idea=frozen.cases[0].input;
const proposal={target_repo:repo,target_path:'SIDE_IDEAS.md',operation:'append_side_idea',title:'Synthetic self-tape acceptance fixture',body:idea,scope:'acting / creator workflow'};
const route=(plain_summary,extra={})=>({route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary,...extra});
const ideaRoute=route('The tension is the tiny finished monologue versus the repeated takes. The idea is pending a verified canonical save.',{route_kind:'side_idea',proposal});
const statusRoute=route('V1 has local proof but is not verified ready; production write/reread/D1 acceptance remains unverified.');
const blob=content=>createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0'+content).digest('hex');

// The actual GitHub adapter, policy/Workers AI adapters, service and memory
// store execute. Every external request terminates in this isolated HTTP store.
// Provider outputs below are controlled probes: semantic usefulness is never PASS.
function setup(output,{content=multiple,duplicate=false,failReadback=false}={}) {
  let clock=Date.parse('2026-10-09T15:00:00Z'),writes=0,modelCalls=0,packet;
  const files=new Map([
    ['ACTIVE_WORK.md',content],['PROJECT_INDEX.md',index],[matrixPath,matrix],
    ['SIDE_IDEAS.md','# Side Ideas\n'+(duplicate?`\n### ${proposal.title}\n**Scope:** ${proposal.scope}\n${idea}\n`:'')],
    ['shared-capabilities/ai-workflows/LEARNED_CHANGE_LOG.md','# Learned changes\n'],
    ['shared-capabilities/ai-workflows/SECOND_BRAIN_CONTROL_PLANE.md','# Mary Kate comparison\nThe existing comparison distinguishes chat carrying goals from verified execution and Project Truth authority.']
  ]);
  const trace=[],store=createMemoryStore({now:()=>new Date(clock).toISOString()});
  const github=createGitHubAdapter({tokenProvider:async()=> 'fixture-token',fetchImpl:async(url,options={})=>{
    const u=new URL(url),prefix='/repos/'+repo+'/contents/';
    if(u.origin!=='https://api.github.com'||!u.pathname.startsWith(prefix)) throw new Error('External network disabled in acceptance fixture');
    const path=decodeURIComponent(u.pathname.slice(prefix.length));
    trace.push({method:options.method||'GET',path});
    if(!files.has(path)) return Response.json({message:'fixture missing'},{status:404});
    if(options.method==='PUT') {
      const data=JSON.parse(options.body);
      if(data.sha!==blob(files.get(path))) return Response.json({message:'version conflict'},{status:409});
      writes++;const content=Buffer.from(data.content,'base64').toString();files.set(path,content);
      return Response.json({commit:{sha:'fixture-commit-'+writes},content:{sha:blob(content)}});
    }
    if(failReadback&&writes) return Response.json({message:'unavailable'},{status:503});
    return Response.json({content:Buffer.from(files.get(path)).toString('base64'),sha:blob(files.get(path))});
  }});
  const router=createPolicyRoutingAdapter({AI:{run:async(model,request)=>{
    modelCalls++;packet=JSON.parse(request.messages[1].content).context;
    trace.push({provider:'workers-ai',model});
    return {tool_calls:[{name:'submit_control_route',arguments:structuredClone(output)}]};
  }}});
  const service=createControlService({github,router,store,now:()=>clock});
  return {service,store,files,trace,advance:ms=>{clock+=ms;},get writes(){return writes;},get calls(){return modelCalls;},get packet(){return packet;}};
}
const metrics=()=>({unnecessary_clarification:0,missing_preservation:0,invented_authority:0,incorrect_routing:0,unsupported_success_claims:0,duplicate_preservation:0,stale_authority_overwrite:0});
const observations=[];
for(const entry of frozen.cases) {
  const id=entry.id;
  let output=statusRoute,options={},status='PARTIAL',finding='',approved=null,error=null,result=null;
  if(['A','duplicate','readback-failure'].includes(id)) output=ideaRoute;
  if(id==='C') output=route('Both use conversation to carry goals forward; Mary Kate intends Project Truth to remain authoritative.');
  if(id==='E') output=route('Saved and verified the key changes in Project Truth.');
  if(id==='F') output=route('Continuing the agreed read-only V1 assessment.');
  if(id==='invalid-target') output={...ideaRoute,proposal:{...proposal,target_repo:'fixture/invalid-target'}};
  if(id==='unsupported-claim') output=route('Saved to Project Truth and independently verified.');
  if(id==='stale-approval') output=route('Update the next action',{route_kind:'state_update',proposal:{target_repo:repo,target_path:'ACTIVE_WORK.md',operation:'replace_field',section:mk,field:'Next bounded action',value:'The older reviewed next action'}});
  if(id==='D-unique') options.content=single;
  if(id==='duplicate') options.duplicate=true;
  if(id==='readback-failure') options.failReadback=true;
  if(id==='conflict') options.content=multiple.replace('**Current:** Local proof only','**Current:** Local proof only\n**Current:** Production complete');
  const f=setup(output,options),m=metrics();
  if(['E','F'].includes(id)) await f.store.addInteraction({raw_text:id==='E'?'Correction: the fixture V1 status remains unverified.':'Read the current MK V1 assessment next; this read-only action is authorized.',route:route(id==='E'?'Material correction requiring current-state and learned-change reconciliation.':'The next agreed action is the read-only MK V1 assessment.')});
  if(id==='expired-source') {
    await f.service.state();f.advance(300001);
    f.files.set('ACTIVE_WORK.md',multiple.replace('Local proof only','Newly fetched last-known state'));
  }
  try{result=await f.service.capture(entry.input);}catch(e){error=e;}
  if(['A','duplicate','readback-failure','stale-approval'].includes(id)&&result?.queue_item) {
    // Exact permission is supplied only by this isolated scenario, not inferred
    // from model confidence or from a real user's unrelated assent.
    if(id==='stale-approval') f.files.set('ACTIVE_WORK.md',multiple.replace('Read the canonical V1 evidence','Newer canonical action that must survive'));
    try{approved=await f.service.approve(result.queue_item.id);}catch(e){error=e;}
  }
  const history=await f.store.listHistory(30),queue=await f.store.listQueues();
  const rawRetained=history.some(row=>row.raw_text===entry.input);
  const reads=f.trace.filter(x=>x.method==='GET').map(x=>x.path);
  const hasMatrix=reads.includes(matrixPath)&&f.packet?.completion_authority?.source?.path===matrixPath;
  const layers={natural_language_understanding:'UNVERIFIED: controlled provider probe',retrieval_freshness:'FAIL: required workflow authority not retrieved',workstream_intent:'UNVERIFIED: provider classification supplied',worker_selection:'PARTIAL: actual fixed routing policy; no delegated worker',user_response:'UNVERIFIED: supplied model response',durable_capture:'NOT_REQUIRED',permissions:'PASS: fixture-isolated effects',reread_receipt:'NOT_REQUIRED',failure_recovery:'NOT_EXERCISED'};
  if(id==='A') {
    status=approved?.receipt?.status==='verified'?'PARTIAL':'FAIL';
    layers.durable_capture=layers.reread_receipt=status==='PARTIAL'?'PASS: isolated canonical file verified':'FAIL';
    layers.retrieval_freshness='PARTIAL: target reread; creative capture authority not supplied to model';
    finding='An exact test-fixture approval completes conditional write/reread/receipt. Natural understanding and authority selection remain unverified; this is not end-to-end product PASS.';
  } else if(['B','D-unique'].includes(id)) {
    if(id==='B') layers.retrieval_freshness=hasMatrix?'PASS: indexed current assessment':'FAIL';
    else layers.retrieval_freshness='PARTIAL: sole project is available, no scoped prior-state receipt';
    finding='Retrieval/wiring executes without unauthorized write; useful natural-language understanding was not exercised by a live provider.';
  } else if(id==='C') {status='FAIL';finding='Existing comparison authority is not retrieved; this-system referent and conversational worker context are absent.';m.incorrect_routing=1;
  } else if(id==='E') {status='FAIL';finding='Save key reaches generic routing without the seeded correction/history or fan-out; no canonical writes despite a saved claim.';m.missing_preservation=1;m.incorrect_routing=1;m.unsupported_success_claims=1;layers.durable_capture='FAIL: material delta not promoted';
  } else if(id==='F') {status='FAIL';finding='Immediately preceding authorized action/history is not passed into the task packet; assessment not retrieved or completed.';m.incorrect_routing=1;
  } else if(['D-multiple','consequential-assent','conflict'].includes(id)) {
    const correct=controlErrorResponse(error).code===(id==='conflict'?'prior_state_conflict':'prior_state_ambiguous_scope')&&f.calls===0&&f.writes===0;
    status=correct?'PASS':'FAIL';layers.natural_language_understanding='PASS: deterministic scope/conflict rule';layers.failure_recovery=correct?'PASS: actionable failure, no guessed action':'FAIL';
    layers.retrieval_freshness='PASS: authoritative fixture scope/conflict retrieved';layers.workstream_intent=status;layers.worker_selection='PASS: no dispatch before scope is resolved';layers.user_response=correct?'PASS: concise clarification/conflict with choices':'FAIL';
    finding=correct?'Deterministic gate stops before dispatch and effects.': 'Required pre-dispatch boundary failed.';
  } else if(id==='invalid-target') {
    status=error?.code==='routing_contract_invalid'&&f.writes===0&&rawRetained?'PASS':'FAIL';
    m.missing_preservation=rawRetained?0:1;layers.durable_capture=rawRetained?'PASS: original privately recoverable; canonical promotion still failed':'FAIL: original input discarded';layers.failure_recovery=layers.durable_capture;
    finding='Invalid target is rejected without coercion; '+(rawRetained?'original input survives privately.':'only sanitized diagnostic survives; original idea is lost.');
  } else if(id==='duplicate') {
    const count=f.files.get('SIDE_IDEAS.md').split(idea).length-1;
    status=count===1?'PASS':'FAIL';m.duplicate_preservation=count>1?1:0;finding=`Exact existing idea occurs ${count} times after fixture approval; operation idempotency does not deduplicate separate idea captures.`;layers.durable_capture=status;
  } else if(id==='stale-approval') {
    const survived=f.files.get('ACTIVE_WORK.md').includes('Newer canonical action that must survive');
    status=survived&&f.writes===0?'PASS':'FAIL';m.stale_authority_overwrite=survived?0:1;finding='Canonical state changed after proposal capture; '+(survived?'new state survived.':'approval reread latest SHA but overwrote the newer next action.');layers.permissions=status;layers.retrieval_freshness=status;
  } else if(id==='unsupported-claim') {
    status=result?.plain_summary.includes('Saved to Project Truth')&&f.writes===0?'FAIL':'PASS';m.unsupported_success_claims=status==='FAIL'?1:0;finding='Deterministic note capture does not verify canonical preservation; returned response is checked against actual effects.';
  } else if(id==='expired-source') {
    const fresh=f.packet?.prior_state?.evidence.some(e=>e.value==='Newly fetched last-known state');
    status=fresh&&hasMatrix?'PASS':'FAIL';finding='Expired local context rereads the changed source before routing; this does not prove live worker telemetry.';layers.retrieval_freshness=status;
  } else if(id==='readback-failure') {
    status=Boolean(error)&&!approved&&history.some(h=>h.receipt?.status==='failed')?'PASS':'FAIL';finding='Unavailable fixture canonical reread prevents verified success and stores failed receipt.';layers.reread_receipt=status;layers.failure_recovery=status;
  }
  observations.push({...entry,status,finding,layers,metrics:m,actual:{model_calls:f.calls,reads,trace:f.trace,response:result,error:error?controlErrorResponse(error):null,approved,canonical_fixture_writes:f.writes,raw_input_retained:rawRetained,queue_rows:queue.needs_ashley.length+queue.ai_can_handle.length,history_rows:history.length,packet_keys:Object.keys(f.packet||{})}});
}
const fingerprints=Object.fromEntries(await Promise.all(['../../src/control/service.js','../../src/control/adapters.js','./workflow-adherence-cases.json'].map(async path=>[path,createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex')])));
const complete=observations.every(x=>x.status==='PASS');
const report={baseline:frozen.implementation_baseline,evaluated_revision:process.argv[3]||'working tree; see source fingerprints',fingerprints,authority_revision:frozen.authority_revision,environment:{platform:process.platform,architecture:process.arch,node:process.version},boundary:'Actual service/policy/Workers AI/GitHub adapters with isolated HTTP contents and private memory store. No real GitHub mutation, external model call, production/UI test, or semantic-model PASS. Counts/metrics describe this controlled corpus, not production error rates.',cases:observations,counts:Object.fromEntries(['PASS','PARTIAL','FAIL'].map(s=>[s,observations.filter(x=>x.status===s).length])),metrics:Object.fromEntries(Object.keys(metrics()).map(k=>[k,observations.reduce((n,x)=>n+x.metrics[k],0)])),overall:complete?'PASS':'FAIL: workflow usefulness, preservation and safety not established together'};
const target=process.argv[2];if(target) await writeFile(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,metrics:report.metrics,overall:report.overall,cases:observations.map(({id,status,finding})=>({id,status,finding}))},null,2));
process.exitCode=complete?0:1; // Partial workflow evidence must keep acceptance red.
