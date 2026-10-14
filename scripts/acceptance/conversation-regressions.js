// Extension of the existing acceptance scripts: actual control service and
// provider adapters, isolated canonical HTTP store, independently scored output.
// No expected behavior is placed in a provider request.
import {createControlService,createMemoryStore,controlErrorResponse} from '../../src/control/service.js';
import {createGitHubAdapter,createPolicyRoutingAdapter} from '../../src/control/adapters.js';

const repo='ashleybrookeugc/research-vault';
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');
const copy=value=>structuredClone(value);
const routeStub=plain_summary=>({route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary});

export const isolatedTruth={
  'ACTIVE_WORK.md':'# Synthetic isolated Project Truth\n## Current active workstreams\n### Mary Kate / AI operating system — ACTIVE NOW\n**Current stage:** Conversation acceptance\n**Current assessment:** Component evidence exists; conversational acceptance is open\n**Next bounded action:** Inspect the current assessment\n### Video analyzer — ACTIVE / PARALLEL\n**Current stage:** Cloud repair\n**Current objective:** Verify the existing uploaded-file workflow\n### UGC campaign campaign-regression-01 — PAUSED / RESUMABLE\n**Current stage:** Edit review\n**Locked decisions:** First sip; recorded rating 7/10; lid observation\n## Session handoff rule\n',
  'PROJECT_INDEX.md':'| Mary Kate current V1 completion/gap/evidence status | `research/ai-workflows/fixture-v1-assessment.md` | `ACTIVE_WORK.md` |\n',
  'research/ai-workflows/fixture-v1-assessment.md':'**canonical_for:** V1 completion assessment\nSynthetic isolated fixture: routing component proofs exist; natural-conversation acceptance and hosted uploaded-video acceptance remain unverified.\n',
  'SIDE_IDEAS.md':'# Synthetic isolated side ideas\n'
};

export async function executeConversationCase(entry,{AI,model='@cf/meta/llama-3.1-8b-instruct-fp8',evidenceKind='blocked',authorizedNonproduction=false,revision=null,authority=null}={}) {
  if(!entry.turns?.length||entry.turns.at(-1).role!=='user') throw new Error('Final turn must be a user message');
  const preceding=entry.turns.slice(0,-1);
  // Never silently convert assistant proposals into user instructions.
  if(preceding.length%2||preceding.some((turn,i)=>turn.role!==(i%2?'assistant':'user')||typeof turn.content!=='string')) throw new Error('Role-preserving paired preceding turns required');
  const files=new Map(Object.entries(isolatedTruth)),trace=[],store=createMemoryStore();
  for(let i=0;i<preceding.length;i+=2) await store.addInteraction({raw_text:preceding[i].content,route:routeStub(preceding[i+1].content)});
  const before={files:Object.fromEntries(files),history:await store.listHistory(100),queues:await store.listQueues()};
  let calls=0,completedCalls=0,packet=null,response=null,error=null;
  const sha=async content=>digest(content);
  const github=createGitHubAdapter({tokenProvider:async()=> 'isolated-fixture-token',fetchImpl:async(url,options={})=>{
    const u=new URL(url),prefix='/repos/'+repo+'/contents/';
    if(u.origin!=='https://api.github.com'||!u.pathname.startsWith(prefix)) throw new Error('External request denied by conversation fixture');
    const path=decodeURIComponent(u.pathname.slice(prefix.length));
    trace.push({kind:'canonical_http',method:options.method||'GET',path,arguments:options.body?JSON.parse(options.body):null});
    if(options.method&&options.method!=='GET') throw Object.assign(new Error('Canonical writes disabled in conversation fixture'),{code:'fixture_side_effect_denied'});
    if(!files.has(path)) return Response.json({message:'Isolated fixture missing'},{status:404});
    return Response.json({content:btoa(unescape(encodeURIComponent(files.get(path)))),sha:await sha(files.get(path))});
  }});
  const enabled=authorizedNonproduction&&AI&&['workers-ai-live','recorded-probe'].includes(evidenceKind);
  const env={CONTROL_WORKERS_AI_MODEL:model,...(enabled?{AI:{run:async(selected,request)=>{
    if(++calls>1) throw new Error('One provider call per case limit exceeded');
    const event={kind:'inference',provider:'workers-ai',model:selected,request:copy(request),response:null,error:null};trace.push(event);
    try {event.response=copy(await AI.run(selected,request));completedCalls++;return event.response;}
    catch(e){event.error={code:e.code||'provider_error',message:'Authorized inference failed'};throw e;}
  }}}:{})};
  const policy=createPolicyRoutingAdapter(env,{openrouter:{route:async()=>{throw Object.assign(new Error('No authorized non-production AI binding; fallback disabled'),{code:'inference_unavailable'});}}});
  const router={route:async(input,context)=>{packet=copy(context);trace.push({kind:'routing_attempt',input,context:copy(context)});return policy.route(input,context);}};
  const service=createControlService({github,router,store});
  try {response=await service.capture(entry.turns.at(-1).content);} catch(e){error=controlErrorResponse(e);}
  const after={files:Object.fromEntries(files),history:await store.listHistory(100),queues:await store.listQueues()};
  const queueRows=queues=>[...queues.needs_ashley,...queues.ai_can_handle];
  const attemptedTools=trace.filter(x=>x.kind==='inference').flatMap(x=>(x.response?.tool_calls||[]).map(tool=>({name:tool.name,arguments:copy(tool.arguments)})));
  const reads=trace.filter(x=>x.kind==='canonical_http'&&x.method==='GET').map(x=>x.path);
  const attemptedWrites=trace.filter(x=>x.kind==='canonical_http'&&x.method!=='GET');
  const proposals=attemptedTools.filter(x=>x.arguments?.proposal);
  const expectedContext=preceding;
  const providerRequest=trace.find(x=>x.kind==='inference')?.request;
  const deliveredTurns=providerRequest?(providerRequest.tools?JSON.parse(providerRequest.messages[1].content).context.recent_conversation?.turns:providerRequest.messages.slice(2,-1)):null;
  const checks={
    exact_provider_turns:providerRequest?JSON.stringify(deliveredTurns)===JSON.stringify(expectedContext):null,
    exact_preceding_turns:packet?JSON.stringify(packet.recent_conversation?.turns)===JSON.stringify(expectedContext):null,
    required_retrieval:(entry.required_reads||[]).every(path=>reads.includes(path)),
    required_context_facts_available:(entry.required_context_facts||[]).every(value=>packet&&JSON.stringify(packet.active_work?.projects).includes(value)),
    canonical_unchanged:JSON.stringify(before.files)===JSON.stringify(after.files),
    unrelated_interactions_unchanged:before.history.every(row=>JSON.stringify(after.history.find(x=>x.id===row.id))===JSON.stringify(row)),
    no_unauthorized_tools:attemptedTools.every(x=>x.name==='submit_control_route')&&attemptedWrites.length===0&&proposals.length===0,
    queue_delta_allowed:queueRows(after.queues).length-queueRows(before.queues).length<=(entry.deterministic.max_queue_delta||0),
    response_available:Boolean(response?.plain_summary),
    response_kind:response?response.route_kind==='temporary_context'&&response.responsibility==='ai_can_handle':null,
    no_model_permission_grant:!packet||packet.recent_conversation?.permission_authority===false
  };
  const receipt={version:'mary-kate.conversation-regression.v1',case_id:entry.id,name:entry.name,observed_at:new Date().toISOString(),revision,authority,evidence_kind:enabled?evidenceKind:'blocked',conversation:copy(entry.turns),preceding_turn_provenance:'seeded synthetic role-preserving fixture',project_truth:{kind:'synthetic isolated snapshot; not production truth',before:before.files,source_shas:Object.fromEntries(await Promise.all([...files].map(async([p,c])=>[p,await sha(c)]))),retrieved_paths:reads,packet},model:{provider:'workers-ai',model,configuration:{temperature:0,max_tokens:700},authorized_nonproduction:Boolean(enabled)},actual:{response,error,tool_calls:attemptedTools,trace,inference_calls:calls,completed_inference_calls:completedCalls,attempted_state_changes:{canonical:attemptedWrites,proposals},completed_state_changes:{canonical:[],private_interactions:after.history.filter(x=>!before.history.some(b=>b.id===x.id)),queue_items:queueRows(after.queues).filter(x=>!queueRows(before.queues).some(b=>b.id===x.id))},before,after},expected:{behavior:entry.expected,forbidden:entry.forbidden,semantic_dimensions:entry.semantic_dimensions,deterministic:entry.deterministic},deterministic_checks:checks,semantic_review:{status:'NOT_EXECUTED',reason:'Independent structured evaluation required; router output is not a verdict.'}};
  receipt.observed_behavior={stage:error?.code==='prior_state_ambiguous_scope'&&!calls?'pre_dispatch_rejected':completedCalls?'provider_returned':calls?'provider_failed':'inference_unavailable',context_delivery:packet?'observed at actual routing boundary':'not reached',semantic_interpretation:'NOT_EVALUATED',contextual_approval:entry.id==='20261014-C'&&error?.code==='prior_state_ambiguous_scope'?'Observed pre-dispatch failure to bind the sole proposal; live semantic execution remains blocked':'not separately evaluated'};
  receipt.execution_digest=await digest(receipt);
  receipt.result=receipt.evidence_kind!=='workers-ai-live'||!completedCalls?'BLOCKED':Object.values(checks).some(x=>x!==true)?'FAIL':'BLOCKED_SEMANTIC_REVIEW';
  return receipt;
}

export async function runConversationRegressions(cases,options={}) {
  const receipts=[];
  // Dependent conversational steps and mutations are never parallelized.
  for(const entry of cases) receipts.push(await executeConversationCase(entry,options));
  return {version:'mary-kate.conversation-regression-suite.v1',observed_at:new Date().toISOString(),evidence_kind:options.evidenceKind||'blocked',overall:receipts.every(x=>x.result==='PASS')?'PASS':receipts.some(x=>x.result==='FAIL')?'FAIL':'BLOCKED',receipts,cloudflare:{deployed:false,authenticated_ui_acceptance:'NOT_EXECUTED'},side_effect_boundary:'Only env.AI.run may leave the isolated runtime when explicitly authorized. GitHub HTTP is intercepted; no real write, message, deployment, or external tool is exposed.'};
}

// A human or separate evaluator supplies judgment, bound to exact execution.
// This does not call a judge model or permit the router to certify itself.
export async function scoreConversationReceipt(receipt,review) {
  const {execution_digest,result,...execution}=receipt;
  if(await digest(execution)!==execution_digest) return {result:'FAIL',reason:'Execution receipt changed after capture'};
  if(receipt.evidence_kind!=='workers-ai-live'||!receipt.actual.completed_inference_calls) return {result:'BLOCKED',reason:'No live inference evidence'};
  if(Object.values(receipt.deterministic_checks).some(x=>x!==true)) return {result:'FAIL',reason:'Observable contract failure'};
  if(!review||review.execution_digest!==receipt.execution_digest||!review.reviewer?.id) return {result:'BLOCKED_SEMANTIC_REVIEW',reason:'Independent review tied to this execution is required'};
  if(review.reviewer.kind!=='human'&&!(review.reviewer.kind==='separate_model'&&review.reviewer.model&&review.reviewer.model!==receipt.model.model)) return {result:'BLOCKED_SEMANTIC_REVIEW',reason:'Router self-certification is forbidden'};
  const text=receipt.actual.response.plain_summary;
  const dimensions=receipt.expected.semantic_dimensions;
  if(!Array.isArray(review.assessments)||review.assessments.length!==dimensions.length||new Set(review.assessments.map(x=>x.dimension)).size!==dimensions.length||dimensions.some(d=>!review.assessments.some(x=>x.dimension===d))) return {result:'BLOCKED_SEMANTIC_REVIEW',reason:'Every semantic dimension requires a separate assessment'};
  if(review.assessments.some(x=>!['PASS','FAIL'].includes(x.verdict)||!x.reason||!Array.isArray(x.response_quotes)||!x.response_quotes.length||x.response_quotes.some(q=>typeof q!=='string'||!q||!text.includes(q)))) return {result:'BLOCKED_SEMANTIC_REVIEW',reason:'Each assessment needs a reason and verbatim observed-response evidence'};
  return {result:review.assessments.every(x=>x.verdict==='PASS')?'PASS':'FAIL',semantic_review:copy(review)};
}
