import {createDeterministicRoutingAdapter,createWorkersAiRoutingAdapter,modelPrompt,readOnlyTextResult,unresolvedFollowup} from './adapters.js';
import {modelTaskProfile} from './triage.js';

// Selection is application policy, never a model-granted permission. Candidates
// are not eligible until the server records task-specific acceptance evidence.
export const MODEL_CATALOG=[
  {id:'llama',provider:'workers-ai',model:'@cf/meta/llama-3.1-8b-instruct-fp8',tasks:['conversation','action'],inputNeurons:13778,outputNeurons:26128},
  {id:'qwen',provider:'workers-ai',model:'@cf/qwen/qwen3-30b-a3b-fp8',tasks:['conversation','reasoning'],inputNeurons:4625,outputNeurons:30475},
  {id:'coder',provider:'workers-ai',model:'@cf/qwen/qwen2.5-coder-32b-instruct',tasks:['coding'],inputNeurons:60000,outputNeurons:90909}
];
const integer=(value,fallback,min,max)=>{const n=Number(value??fallback);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:fallback;};
const fail=(code,message)=>Object.assign(new Error(message),{code,status:503});
const readOnly=context=>['read_only_advice','read_only_assessment'].includes(context?.intent);
export function taskProfile(input,context={}) {
  return modelTaskProfile(input,context);
}
function accepted(env,id,task){return String(env.CONTROL_MODEL_ACCEPTANCE||'').split(',').map(x=>x.trim()).includes(id+':'+task);}
function candidates(env) {
  const list=MODEL_CATALOG.map(x=>({...x}));
  if(/^[a-zA-Z0-9._-]{1,100}$/.test(env.CONTROL_OPENAI_MODEL||''))list.push({id:'openai',provider:'openai',model:env.CONTROL_OPENAI_MODEL,tasks:['conversation','reasoning','coding']});
  return list;
}
export function automaticModelStatus(env) {
  return {version:'mary-kate.automatic-models.v1',enabled:env.CONTROL_AUTO_MODELS==='true',mode:env.CONTROL_ALLOW_PAID_MODELS==='true'?'free_first_with_budget':'free_only',max_calls_per_request:1,daily_call_limit:integer(env.CONTROL_MODEL_DAILY_CALL_LIMIT,25,1,1000),paid_connected:Boolean(env.CONTROL_OPENAI_API_KEY),models:candidates(env).map(x=>({id:x.id,provider:x.provider,model:x.model,tasks:x.tasks,accepted_tasks:x.tasks.filter(task=>accepted(env,x.id,task)),connected:x.provider==='workers-ai'?Boolean(env.AI?.run&&env.CONTROL_WORKERS_FREE_PLAN_CONFIRMED==='true'):Boolean(env.CONTROL_OPENAI_API_KEY)})),quality:'Acceptance must be established separately for each task; selection is not a quality guarantee.',free_plan_confirmed:env.CONTROL_WORKERS_FREE_PLAN_CONFIRMED==='true',allowance:'Cloudflare quota is shared with other workloads; this local limit is not a remaining-account-quota reading.'};
}
export function selectModel(env,input,context) {
  const task=taskProfile(input,context),outputTokens=task==='coding'||task==='reasoning'?1400:700;
  const pool=candidates(env).filter(x=>x.tasks.includes(task)&&accepted(env,x.id,task)&&(x.provider==='workers-ai'?env.AI?.run&&env.CONTROL_WORKERS_FREE_PLAN_CONFIRMED==='true':env.CONTROL_ALLOW_PAID_MODELS==='true'&&env.CONTROL_OPENAI_API_KEY));
  const free=pool.filter(x=>x.provider==='workers-ai').sort((a,b)=>(a.inputNeurons+a.outputNeurons)-(b.inputNeurons+b.outputNeurons));
  const selected=free[0]||pool.find(x=>x.provider==='openai');
  if(!selected)throw fail('model_not_ready','No connected model has passed the required checks for this task. Paid use remains governed by your settings.');
  return {...selected,task,outputTokens,effort:task==='conversation'?'low':'high',reason:free.length?'Lowest estimated cost among accepted compatible free-tier candidates.':'No accepted free candidate; explicitly enabled budgeted connection.'};
}
export const MODEL_USAGE_SCHEMA='CREATE TABLE IF NOT EXISTS control_model_usage (day TEXT PRIMARY KEY,calls INTEGER NOT NULL,neurons_reserved INTEGER NOT NULL,micro_usd_reserved INTEGER NOT NULL);';
export function createModelUsageStore(db,{now=()=>Date.now()}={}) {
  return {async reserve({neurons,microUsd,callLimit,neuronLimit,microUsdLimit}){
    const day=new Date(now()).toISOString().slice(0,10);
    const row=await db.prepare('INSERT INTO control_model_usage(day,calls,neurons_reserved,micro_usd_reserved) SELECT ?,1,?,? WHERE ? <= ? AND ? <= ? ON CONFLICT(day) DO UPDATE SET calls=calls+1,neurons_reserved=neurons_reserved+excluded.neurons_reserved,micro_usd_reserved=micro_usd_reserved+excluded.micro_usd_reserved WHERE calls < ? AND neurons_reserved+excluded.neurons_reserved <= ? AND micro_usd_reserved+excluded.micro_usd_reserved <= ? RETURNING calls,neurons_reserved,micro_usd_reserved').bind(day,neurons,microUsd,neurons,neuronLimit,microUsd,microUsdLimit,callLimit,neuronLimit,microUsdLimit).first();
    return Boolean(row);
  }};
}
export function createAutomaticModelRouter(env,{usageStore,fetchImpl=fetch,now=()=>Date.now()}={}) {
  const deterministic=createDeterministicRoutingAdapter();
  return {async route(input,context={}){
    const local=await deterministic.route(input,context);if(local)return {...local,model_selection:{provider:'none',calls:0,task:'private_capture'}};
    if(unresolvedFollowup(input,context))return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary:'What do you mean by “'+input.trim()+'”?',why:'clarification_required:unresolved_followup_terms',model_selection:{provider:'none',calls:0,task:'clarification'}};
    const selection=selectModel(env,input,context);
    const messages=modelPrompt(input,context),bytes=new TextEncoder().encode(JSON.stringify(messages)).length;
    if(bytes>24000)throw fail('model_context_limit','This request needs a smaller relevant context before an AI call can run.');
    // Conservative byte-based input allowance includes framing; no summarizer call.
    const inputBound=bytes+2048;
    let neurons=0,microUsd=0;
    const microUsdLimit=integer(env.CONTROL_MODEL_DAILY_MICRO_USD,0,0,100000000);
    if(selection.provider==='workers-ai')neurons=Math.ceil((inputBound*selection.inputNeurons+selection.outputTokens*selection.outputNeurons)/1000000);
    else {
      const inputRate=Number(env.CONTROL_OPENAI_INPUT_USD_PER_MILLION),outputRate=Number(env.CONTROL_OPENAI_OUTPUT_USD_PER_MILLION),verified=Date.parse(env.CONTROL_OPENAI_PRICE_VERIFIED_AT||'');
      if(!env.CONTROL_SPENDING_POLICY||!Number.isFinite(inputRate)||inputRate<=0||!Number.isFinite(outputRate)||outputRate<=0||!Number.isFinite(verified)||now()-verified>86400000||verified>now()||!microUsdLimit)throw fail('model_budget_missing','Paid AI is not ready: an approved budget and current price configuration are required.');
      microUsd=Math.ceil(inputBound*inputRate+selection.outputTokens*outputRate);
    }
    if(!usageStore||!await usageStore.reserve({neurons,microUsd,callLimit:integer(env.CONTROL_MODEL_DAILY_CALL_LIMIT,25,1,1000),neuronLimit:integer(env.CONTROL_MODEL_DAILY_NEURONS,8000,1,10000),microUsdLimit}))throw fail('model_budget_limit','The configured AI allowance has been reached. No additional model call ran.');
    // Reservations are never refunded after failure: a timed-out call may be billed.
    let result;
    if(selection.provider==='workers-ai') {
      const AI={run:(model,request)=>env.AI.run(model,{...request,max_tokens:selection.outputTokens})};
      try { result=await createWorkersAiRoutingAdapter({...env,AI,CONTROL_WORKERS_AI_MODEL:selection.model}).route(input,context); }
      catch { throw fail('model_provider_failed','The selected AI could not complete this request. No automatic retry or paid fallback ran.'); }
    } else {
      let response;
      try { response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+env.CONTROL_OPENAI_API_KEY,'content-type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:selection.model,instructions:messages[0].content,input:messages.slice(1),reasoning:{effort:selection.effort},max_output_tokens:selection.outputTokens,store:false})}); } catch { throw fail('model_provider_failed','The selected AI connection failed. No automatic retry ran.'); }
      if(!response.ok)throw fail('model_provider_failed','The selected AI connection failed. No automatic retry or paid fallback ran.');
      let data;try {data=await response.json();}catch {throw fail('model_provider_failed','The selected AI returned an unreadable response. No automatic retry ran.');}
      if(data.status!=='completed'||!Array.isArray(data.output)||data.output.some(x=>!['message','reasoning'].includes(x.type)))throw fail('model_answer_incomplete','The AI did not return a complete answer. No automatic retry ran.');
      const answer=data.output.filter(x=>x.type==='message'&&x.role==='assistant').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
      result=readOnlyTextResult({response:answer},{provider:'openai',model:selection.model});
    }
    return {...result,model_selection:{version:'mary-kate.model-selection.v1',provider:selection.provider,model:selection.model,task:selection.task,effort:selection.provider==='openai'?selection.effort:null,calls:result.why?.startsWith('clarification_required')?0:1,reason:selection.reason,reserved_neurons:neurons,reserved_micro_usd:microUsd,cost_kind:'conservative_reservation_not_actual_bill'}};
  }};
}
