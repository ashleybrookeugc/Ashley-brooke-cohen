import {WRITE_REPO, validateRoute} from './contracts.js';

const READ_REPOS = new Set(['ashleybrookeugc/research-vault','ashleybrookeugc/ugc-creator-app','ashleybrookeugc/B-Paid','ashleybrookeugc/Ashley-brooke-cohen']);
const api = 'https://api.github.com';
const headers = token => ({authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'AshleyControlPlane/1.0'});

export function createGitHubAdapter({fetchImpl=fetch, tokenProvider}) {
  async function request(url, options, scope) {
    const token = await tokenProvider(scope);
    const response = await fetchImpl(api+url,{...options,headers:{...headers(token),...(options?.headers||{})}});
    if (!response.ok) throw new Error('GitHub '+response.status+': '+(await response.text()).slice(0,300));
    return response.json();
  }
  return {
    async readFile(repo,path,ref='main') {
      if (!READ_REPOS.has(repo)) throw new Error('Repository is not readable');
      const data = await request('/repos/'+repo+'/contents/'+path+'?ref='+encodeURIComponent(ref),{},'read');
      return {content:decodeURIComponent(escape(atob(data.content.replace(/\s/g,'')))),sha:data.sha};
    },
    async writeFile(repo,path,content,sha,message) {
      if (repo !== WRITE_REPO) throw new Error('Writes are restricted to research-vault');
      const data = await request('/repos/'+repo+'/contents/'+path,{method:'PUT',body:JSON.stringify({message,content:btoa(unescape(encodeURIComponent(content))),sha,branch:'main'}),headers:{'content-type':'application/json'}},'write');
      return {commit_sha:data.commit.sha,content_sha:data.content.sha};
    }
  };
}

function pemBytes(pem) {
  const body = pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  return Uint8Array.from(atob(body),c=>c.charCodeAt(0));
}
function url64(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let raw=''; for (const byte of bytes) raw+=String.fromCharCode(byte);
  return btoa(raw).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}

export function createGitHubAppTokenProvider(env,{fetchImpl=fetch,now=()=>Date.now()}={}) {
  const cache = {};
  return async scope => {
    if (cache[scope]?.expires > now()+60000) return cache[scope].token;
    const key = await crypto.subtle.importKey('pkcs8',pemBytes(env.CONTROL_GITHUB_APP_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const issued=Math.floor(now()/1000)-30;
    const unsigned=url64(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+url64(JSON.stringify({iat:issued,exp:issued+540,iss:env.CONTROL_GITHUB_APP_ID}));
    const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
    const repos = scope === 'write' ? ['research-vault'] : ['research-vault','ugc-creator-app','B-Paid','Ashley-brooke-cohen'];
    const permissions = {contents:scope === 'write'?'write':'read'};
    const response=await fetchImpl(api+'/app/installations/'+env.CONTROL_GITHUB_INSTALLATION_ID+'/access_tokens',{method:'POST',headers:{authorization:'Bearer '+unsigned+'.'+url64(new Uint8Array(signature)),accept:'application/vnd.github+json','content-type':'application/json','x-github-api-version':'2022-11-28'},body:JSON.stringify({repositories:repos,permissions})});
    if(!response.ok) throw new Error('GitHub App token '+response.status);
    const data=await response.json(); cache[scope]={token:data.token,expires:Date.parse(data.expires_at)}; return data.token;
  };
}

export function createDeterministicRoutingAdapter() {
  return { async route(input) {
    if (/^(note|remember|for later|just so you know)\b/i.test(input)) return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Saved as private context; no model call or GitHub change.',why:'Deterministic low-stakes capture.'};
    return null;
  }};
}

function modelResult(data) { const text=data.response||data.choices?.[0]?.message?.content||data.output; return validateRoute(typeof text==='string'?JSON.parse(text):data.route||data); }
function modelPrompt(input,context) { return [{role:'system',content:'Return only JSON matching control-route.v1. Never propose a write outside research-vault.'},{role:'user',content:JSON.stringify({input,context})}]; }

export function createWorkersAiRoutingAdapter(env) {
  return { async route(input,context) {
    if(!env.AI) throw new Error('Workers AI is unavailable');
    const data=await env.AI.run(env.CONTROL_WORKERS_AI_MODEL||'@cf/meta/llama-3.1-8b-instruct',{messages:modelPrompt(input,context),max_tokens:700,temperature:0});
    return modelResult(data);
  }};
}

export function createOpenRouterFreeAdapter(env,{fetchImpl=fetch}={}) {
  return { async route(input,context) {
    if(!env.CONTROL_OPENROUTER_API_KEY) throw new Error('OpenRouter free fallback is not configured');
    const model=env.CONTROL_OPENROUTER_MODEL||'openrouter/free';
    if(!model.endsWith(':free')&&model!=='openrouter/free') throw new Error('OpenRouter fallback must use a free model');
    const response=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+env.CONTROL_OPENROUTER_API_KEY,'content-type':'application/json'},body:JSON.stringify({model,messages:modelPrompt(input,context),temperature:0,max_tokens:700})});
    if(!response.ok) throw new Error('OpenRouter '+response.status);
    return modelResult(await response.json());
  }};
}

export function createPolicyRoutingAdapter(env,{workers=createWorkersAiRoutingAdapter(env),openrouter=createOpenRouterFreeAdapter(env),deterministic=createDeterministicRoutingAdapter()}={}) {
  return { async route(input,context) {
    const local=await deterministic.route(input,context); if(local) return local;
    try { return await workers.route(input,context); } catch(error) {
      if(!/429|quota|capacity|unavailable|Workers AI/i.test(String(error?.message||error))) throw error;
      return openrouter.route(input,context);
    }
  }};
}

export function createHttpRoutingAdapter(env,{fetchImpl=fetch}={}) {
  return { async route(input,context) {
    if (env.CONTROL_ALLOW_PAID_MODELS !== 'true' || !env.CONTROL_SPENDING_POLICY) throw new Error('Paid routing requires an explicit spending policy');
    if (!env.CONTROL_MODEL_API_KEY || !env.CONTROL_MODEL_ENDPOINT) throw new Error('Routing model is not configured');
    const response=await fetchImpl(env.CONTROL_MODEL_ENDPOINT,{method:'POST',headers:{authorization:'Bearer '+env.CONTROL_MODEL_API_KEY,'content-type':'application/json'},body:JSON.stringify({contract:'control-route.v1',model:env.CONTROL_MODEL_NAME||null,input,context})});
    if(!response.ok) throw new Error('Routing provider '+response.status);
    const data=await response.json();
    return validateRoute(data.route||data);
  }};
}
