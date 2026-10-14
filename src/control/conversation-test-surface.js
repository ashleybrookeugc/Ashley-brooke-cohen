import {executeConversationCase} from '../../scripts/acceptance/conversation-regressions.js';

const pagePath='/control/conversation-test';
const apiPath='/api/control/conversation-test';
const response=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});

// Only this fixed fixture surface gets env.AI. No production store, GitHub
// token, arbitrary input, external tool or approval executor is reachable.
export function createConversationTestSurface({corpus,page,revision,authorize}) {
  const supplements=corpus.supplements.filter(x=>['2026-10-14-followup-regressions','2026-10-14-clarification-preference','2026-10-14-qwen-comparison'].includes(x.id));
  const cases=supplements.flatMap(x=>x.cases);
  return async(request,env)=>{
    const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
    if(path!==pagePath&&path!==apiPath) return null;
    if(!await authorize(request,env)) return path===apiPath?response({error:'Unauthorized'},401):new Response(null,{status:303,headers:{location:'/admin/login','cache-control':'no-store'}});
    if(path===pagePath) {
      if(request.method!=='GET') return response({error:'Method not allowed'},405);
      return new Response(page,{headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
    }
    if(request.method==='GET') return response({version:'conversation-test.surface.v1',revision,AI_available:Boolean(env.AI?.run),cases:cases.map(({id,name,turns,expected,forbidden})=>({id,name,turns,expected,forbidden})),boundary:'Synthetic fixture context; no production history, files, approvals or external actions. One inference at most per Run, using existing Workers AI quota; remaining quota unverified. Qwen comparison leaves the production model unchanged. No automatic semantic PASS.'});
    if(request.method!=='POST') return response({error:'Method not allowed'},405);
    if(request.headers.get('origin')!==url.origin) return response({error:'Same-origin test request required'},403);
    if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||'')) return response({error:'JSON request required'},415);
    if(Number(request.headers.get('content-length'))>256) return response({error:'Request too large'},413);
    const raw=await request.text();if(new TextEncoder().encode(raw).length>256) return response({error:'Request too large'},413);
    let data;try{data=JSON.parse(raw);}catch{return response({error:'Valid JSON required'},400);}
    if(!data||Array.isArray(data)||Object.keys(data).length!==1||typeof data.case_id!=='string') return response({error:'Select one frozen case; custom prompts and configuration are not accepted'},400);
    const entry=cases.find(x=>x.id===data.case_id);if(!entry) return response({error:'Frozen case not found'},404);
    if(!env.AI?.run) return response({error:'Workers AI binding is unavailable; no inference ran',code:'inference_unavailable'},503);
    const AI={run:async(model,input)=>{try{return await env.AI.run(model,input);}catch{throw Object.assign(new Error('Workers AI inference failed; no verified answer is available'),{code:'inference_failed'});}}};
    try{
      const receipt=await executeConversationCase(entry,{AI,model:entry.candidate_model==='@cf/qwen/qwen3-30b-a3b-fp8'?entry.candidate_model:env.CONTROL_WORKERS_AI_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8',evidenceKind:'workers-ai-live',authorizedNonproduction:true,revision,authority:supplements.find(x=>x.cases.some(c=>c.id===entry.id)).provenance});
      return response(receipt);
    }catch{return response({error:'The isolated test could not produce a receipt. No production change was attempted',code:'fixture_execution_failed'},500);}
  };
}
