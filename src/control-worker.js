import app,{isAdmin} from './auth-worker.js';
import controlPage from '../public/control/index.html';
import {createGitHubAdapter,createGitHubAppTokenProvider,createHttpRoutingAdapter} from './control/adapters.js';
import {createControlService,createD1Store} from './control/service.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
function service(env) {
  const tokens=createGitHubAppTokenProvider(env);
  return createControlService({github:createGitHubAdapter({tokenProvider:tokens}),router:createHttpRoutingAdapter(env),store:createD1Store(env.DB)});
}
async function body(request){try{return await request.json()}catch{throw new Error('Valid JSON body required')}}
async function control(request,env) {
  if(!await isAdmin(request,env)) return new URL(request.url).pathname.startsWith('/api/')?json({error:'Unauthorized'},401):new Response(null,{status:303,headers:{location:'/admin/login','cache-control':'no-store'}});
  const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
  const core=service(env);
  if(path==='/control') return new Response(controlPage,{headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store'}});
  if(path==='/api/control/state'&&request.method==='GET') return json(await core.state());
  if(path==='/api/control/interactions'&&request.method==='POST') return json(await core.capture((await body(request)).text),201);
  const match=path.match(/^\/api\/control\/items\/([\w-]+)\/(approve|reject)$/);
  if(match&&request.method==='POST'){const data=await body(request);return json(match[2]==='approve'?await core.approve(match[1],data.note):await core.reject(match[1],data.note));}
  return json({error:'Not found'},404);
}
export default {
  async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path==='/control'||path.startsWith('/control/')||path.startsWith('/api/control/')){try{return await control(request,env)}catch(error){console.error('Control request failed',error?.message||error);return json({error:error?.message||'Control request failed'},400)}}return app.fetch(request,env,ctx);},
  async scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);}
};
