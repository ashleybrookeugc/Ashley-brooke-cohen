const enc = new TextEncoder();
export const LIMIT = 64 * 1024 * 1024;
export const securityHeaders = {
  'cache-control':'no-store', 'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
export const json = (body,status=200,extra={}) => new Response(JSON.stringify(body),{status,headers:{...securityHeaders,'content-type':'application/json',...extra}});
const hex = bytes => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function digest(text){return hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));}
async function equal(a,b){return await digest(a)===await digest(b);}
async function sign(secret,value){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,enc.encode(value)));}
const cookieName='__Host-video_test';
export async function authorized(request,env,now=Date.now()){
  if(!env.VIDEO_TEST_ACCESS_TOKEN || env.VIDEO_TEST_ACCESS_TOKEN.length<32)return false;
  const cookie=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
  const [expires,signature]=cookie.split('.');
  return /^\d+$/.test(expires)&&Number(expires)>now&&Number(expires)<=now+31*86400000&&signature===await sign(env.VIDEO_TEST_ACCESS_TOKEN,'video-test:'+expires);
}
export async function handleVideoTesting(request,env,{fetchImpl=fetch,now=Date.now()}={}){
  const url=new URL(request.url), path=url.pathname.replace(/\/+$/,'');
  if(!path.startsWith('/api/video-test/'))return null;
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return json({error:'Same-origin request required'},403);
  if(path==='/api/video-test/session'){
    if(request.method==='GET')return json({authenticated:await authorized(request,env,now)});
    if(!env.VIDEO_TEST_ACCESS_TOKEN||env.VIDEO_TEST_ACCESS_TOKEN.length<32)return json({error:'Private testing access has not been configured.'},503);
    const raw=await request.text();if(raw.length>2048)return json({error:'Request too large'},413);
    let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
    if(typeof body.token!=='string'||!await equal(body.token,env.VIDEO_TEST_ACCESS_TOKEN))return json({error:'Invalid testing token'},401);
    const expires=String(now+30*86400000), signature=await sign(env.VIDEO_TEST_ACCESS_TOKEN,'video-test:'+expires);
    return json({authenticated:true},200,{'set-cookie':`${cookieName}=${expires}.${signature}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`});
  }
  if(!await authorized(request,env,now))return json({error:'Testing access required'},401);
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
    const response=await fetchImpl(worker.origin+'/video-worker'+tail,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,duplex:'half',redirect:'manual',signal:AbortSignal.timeout(tail==='/jobs'&&request.method==='POST'?120000:15000)});
    if(response.status>=300&&response.status<400)return json({state:'offline',error:'Worker redirect refused.'},502);
    const outputHeaders=new Headers(securityHeaders);
    for(const name of ['content-type','content-length','content-range','accept-ranges'])if(response.headers.has(name))outputHeaders.set(name,response.headers.get(name));
    return new Response(response.body,{status:response.status,headers:outputHeaders});
  }catch{return json({state:'offline',error:'Analyzer worker is unreachable. Your selected video stays on this device. Check recent runs before retrying an interrupted upload.'},503)}
}
