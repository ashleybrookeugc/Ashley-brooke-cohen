import {isAdmin} from '../admin-session.js';
export const LIMIT = 64 * 1024 * 1024;
export const securityHeaders = {
  'cache-control':'no-store', 'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
export const json = (body,status=200,extra={}) => new Response(JSON.stringify(body),{status,headers:{...securityHeaders,'content-type':'application/json',...extra}});
export const authorized = isAdmin;
export async function handleVideoTesting(request,env,{fetchImpl=fetch,now=Date.now()}={}){
  const url=new URL(request.url), path=url.pathname.replace(/\/+$/,'');
  if(!path.startsWith('/api/video-test/'))return null;
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return json({error:'Same-origin request required'},403);
  if(path==='/api/video-test/session'){
    if(request.method!=='GET')return json({error:'Sign in through Mary Kate.'},405,{allow:'GET'});
    return json({configured:Boolean(env.ADMIN_SESSION_SECRET),authenticated:await authorized(request,env,now)});
  }
  if(!await authorized(request,env,now))return json({error:'Sign in to Mary Kate to analyze videos.'},401);
  const tail=path.slice('/api/video-test'.length);
  const allowed=(request.method==='GET'&&(/^\/(health|jobs)$/.test(tail)||/^\/jobs\/[a-f0-9-]{36}(\/(result|media|feedback|frames\/\d+))?$/.test(tail))) || (request.method==='POST'&&(tail==='/jobs'||/^\/jobs\/[a-f0-9-]{36}\/feedback$/.test(tail)));
  if(!allowed)return json({error:'Not found'},404);
  if(!env.VIDEO_TEST_WORKER_URL||!env.VIDEO_TEST_WORKER_TOKEN)return json({state:'offline',error:'Analyzer worker is not connected. No analysis ran.'},503);
  let worker;try{worker=new URL(env.VIDEO_TEST_WORKER_URL);if(worker.protocol!=='https:'||worker.username||worker.password||worker.search||worker.hash)throw Error();}catch{return json({state:'offline',error:'Secure worker connection is not configured.'},503)}
  const headers=new Headers({'authorization':'Bearer '+env.VIDEO_TEST_WORKER_TOKEN});
  for(const name of ['content-type','content-length','range','x-video-name'])if(request.headers.has(name))headers.set(name,request.headers.get(name));
  if(Number(headers.get('content-length'))>LIMIT)return json({error:'Maximum testing upload is 64 MiB'},413);
  try{
    // Fixed server-configured target, no redirects and no caller-controlled URLs.
    // A VPC Service pins routing to the registered loopback host/port. Cloudflare
    // encrypts traffic to cloudflared; only the local loopback hop uses HTTP.
    const privateService=env.VIDEO_TEST_PRIVATE_SERVICE;
    if(privateService&&typeof privateService.fetch!=='function')return json({state:'offline',error:'Private worker connection is not configured.'},503);
    const target=new URL(worker.origin+'/video-worker'+tail);
    if(privateService)target.protocol='http:';
    const forward=privateService?privateService.fetch.bind(privateService):fetchImpl;
    // A configured private service never falls back to public fetch on failure.
    const response=await forward(target.href,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,duplex:'half',redirect:'manual',signal:AbortSignal.timeout(tail==='/jobs'&&request.method==='POST'?120000:15000)});
    if(response.status>=300&&response.status<400)return json({state:'offline',error:'Worker redirect refused.'},502);
    const outputHeaders=new Headers(securityHeaders);
    for(const name of ['content-type','content-length','content-range','accept-ranges'])if(response.headers.has(name))outputHeaders.set(name,response.headers.get(name));
    return new Response(response.body,{status:response.status,headers:outputHeaders});
  }catch{return json({state:'offline',error:'Analyzer worker is unreachable. Your selected video stays on this device. Check recent runs before retrying an interrupted upload.'},503)}
}
