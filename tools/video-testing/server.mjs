import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,readdir,stat,open} from 'node:fs/promises';
import {join,resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {LIMIT} from '../../src/video-testing/gateway.js';
const here=dirname(fileURLToPath(import.meta.url));
const digest=v=>createHash('sha256').update(v).digest();
const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
async function readJson(path){return JSON.parse(await readFile(path,'utf8'));}
async function save(path,value){const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value),{mode:0o600});await rename(temp,path);}
export async function createVideoWorker({root,modulePath,token,maxBytes=LIMIT}={}){
  if(!token||token.length<32)throw Error('VIDEO_TEST_WORKER_TOKEN must contain at least 32 characters');
  root=resolve(root);modulePath=resolve(modulePath);
  await mkdir(root,{recursive:true,mode:0o700});
  let active=null;
  // A lost process is a failed run, never an invented running/completed state.
  for(const id of await readdir(root))if(/^[a-f0-9-]{36}$/.test(id)){
    const path=join(root,id,'job.json');
    try{const job=await readJson(path);if(['uploading','running'].includes(job.state)){job.state='failed';job.error='Worker restarted before completion. Source retained; select it to retry.';await save(path,job);}}catch{}
  }
  async function ready(){
    try{await stat(modulePath);}catch{return false;}
    return ['ffmpeg','ffprobe','tesseract'].every(cmd=>spawnSync(cmd,[cmd==='tesseract'?'--version':'-version'],{stdio:'ignore'}).status===0);
  }
  async function jobFor(id){return readJson(join(root,id,'job.json'));}
  async function resultFor(id){
    const job=await jobFor(id);if(job.state!=='completed')throw Error('not_completed');
    const stored=await readJson(join(root,id,'result.json'));
    const {verifyEvidencePackage}=await import('node:url').then(({pathToFileURL})=>import(pathToFileURL(modulePath)));
    const checked=await verifyEvidencePackage(stored.package_directory);
    return {...stored,manifest:checked.manifest,evidence:checked.evidence,semantic_input:checked.semantic_input};
  }
  async function streamFile(req,res,path,type){
    const size=(await stat(path)).size;
    let start=0,end=size-1,status=200;
    const range=req.headers.range;
    if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match){res.writeHead(416,{'content-range':`bytes */${size}`});return res.end();}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end||start>=size){res.writeHead(416,{'content-range':`bytes */${size}`});return res.end();}status=206;}
    res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','accept-ranges':'bytes','content-length':end-start+1,...(status===206?{'content-range':`bytes ${start}-${end}/${size}`}:{})});
    createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
  }
  const server=createServer(async(req,res)=>{
    if(!timingSafeEqual(digest(req.headers.authorization||''),digest('Bearer '+token)))return send(res,401,{error:'Unauthorized'});
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    try{
      if(path==='/video-worker/health'&&req.method==='GET')return send(res,200,{state:await ready()?'available':'unavailable',active_job:active,max_bytes:maxBytes,semantic_understanding:'unavailable',note:'Existing sampled evidence analyzer; no creative understanding provider.'});
      if(path==='/video-worker/jobs'&&req.method==='GET'){
        const jobs=[];for(const id of await readdir(root))if(/^[a-f0-9-]{36}$/.test(id))try{jobs.push(await jobFor(id))}catch{}
        return send(res,200,{jobs:jobs.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100)});
      }
      if(path==='/video-worker/jobs'&&req.method==='POST'){
        if(active)return send(res,409,{error:'One analysis is already active. Review recent runs before retrying.'});
        if(!await ready())return send(res,503,{state:'offline',error:'Existing analyzer or media tools are unavailable. No analysis ran.'});
        if(active)return send(res,409,{error:'One analysis is already active.'});
        if(Number(req.headers['content-length'])>maxBytes)return send(res,413,{error:'Upload too large'});
        const id=randomUUID();active=id;const dir=join(root,id);await mkdir(dir,{mode:0o700});
        const job={id,state:'uploading',name:String(req.headers['x-video-name']||'Selected video').slice(0,300),created_at:new Date().toISOString()};
        await save(join(dir,'job.json'),job);
        const source=join(dir,'source.bin'),file=await open(source,'wx',0o600);let bytes=0;
        try{for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes)throw Error('UPLOAD_LIMIT');await file.write(chunk);}if(!bytes)throw Error('EMPTY_UPLOAD');}
        catch(error){job.state='failed';job.error=error.message==='UPLOAD_LIMIT'?'Upload exceeded the limit. No analysis ran.':'Upload interrupted or empty. No analysis ran.';await save(join(dir,'job.json'),job);active=null;return send(res,400,{error:job.error,id});}
        finally{await file.close();}
        job.state='running';job.bytes=bytes;job.started_at=new Date().toISOString();await save(join(dir,'job.json'),job);
        const child=spawn(process.execPath,[join(here,'analyze-child.mjs'),modulePath,source,dir],{stdio:'ignore'});
        let settled=false;
        const finish=async(code)=>{if(settled)return;settled=true;job.state=code===0?'completed':'failed';job.completed_at=new Date().toISOString();if(code!==0)job.error='Analyzer failed. Source is retained; no completed result is claimed.';await save(join(dir,'job.json'),job);active=null;};
        child.on('exit',code=>finish(code).catch(()=>{active=null}));child.on('error',()=>finish(1).catch(()=>{active=null}));
        return send(res,202,job);
      }
      const match=path.match(/^\/video-worker\/jobs\/([a-f0-9-]{36})(?:\/(result|media|feedback|frames\/\d+))?$/);
      if(!match)return send(res,404,{error:'Not found'});
      const [,id,action]=match,dir=join(root,id),job=await jobFor(id);
      if(!action&&req.method==='GET')return send(res,200,job);
      if(action==='media'&&req.method==='GET')return await streamFile(req,res,join(dir,'source.bin'),'video/mp4');
      if(action==='result'&&req.method==='GET'){
        const result=await resultFor(id);
        // Local machine paths are not browser API fields.
        const manifest=structuredClone(result.manifest);delete manifest.source.local_path;delete manifest.persistence.local.package_location;
        return send(res,200,{manifest,evidence:result.evidence,semantic_input:result.semantic_input,readback:result.readback});
      }
      if(action?.startsWith('frames/')&&req.method==='GET'){
        const result=await resultFor(id),frame=result.manifest.coverage.visual_sampling.frames[Number(action.split('/')[1])];
        if(!frame)return send(res,404,{error:'Frame unavailable'});
        const file=resolve(result.package_directory,frame.relative_path);
        if(!file.startsWith(resolve(result.package_directory)+sep))return send(res,400,{error:'Invalid frame'});
        return await streamFile(req,res,file,'image/jpeg');
      }
      if(action==='feedback'){
        const folder=join(dir,'feedback');await mkdir(folder,{recursive:true,mode:0o700});
        if(req.method==='GET'){const feedback=[];for(const file of await readdir(folder))if(file.endsWith('.json'))feedback.push(await readJson(join(folder,file)));return send(res,200,{feedback});}
        if(req.method==='POST'){
          let raw='';for await(const part of req){raw+=part;if(raw.length>20000)return send(res,413,{error:'Feedback too large'});}
          let body;try{body=JSON.parse(raw)}catch{return send(res,400,{error:'Invalid JSON'});}
          if(!/^[a-f0-9-]{36}$/.test(body.id)||typeof body.text!=='string'||!body.text.trim()||body.text.length>8000||typeof body.observation_id!=='string'||body.observation_id.length>200||!Number.isFinite(body.timestamp_seconds)||body.timestamp_seconds<0)return send(res,400,{error:'Invalid feedback'});
          const result=await resultFor(id);
          if(body.source_sha256!==result.manifest.content_sha256||body.timestamp_seconds>result.manifest.duration_seconds)return send(res,409,{error:'Feedback source or timestamp does not match this run'});
          if(body.observation_id!=='general'&&!Object.values(result.evidence.lanes).some(lane=>[...(lane.observations||[]),...(lane.spans||[]),...(lane.raw_observations||[])].some(o=>o.observation_id===body.observation_id)))return send(res,409,{error:'Unknown observation'});
          const saved={id:body.id,job_id:id,source_sha256:body.source_sha256,observation_id:body.observation_id,timestamp_seconds:body.timestamp_seconds,text:body.text,kind:'creator_correction',created_at:new Date().toISOString(),analyzer_version:result.manifest.processing.analyzer_version};
          const target=join(folder,body.id+'.json');
          try{await writeFile(target,JSON.stringify(saved),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;const prior=await readJson(target);if(prior.text!==saved.text||prior.observation_id!==saved.observation_id||prior.timestamp_seconds!==saved.timestamp_seconds||prior.source_sha256!==saved.source_sha256)return send(res,409,{error:'Feedback ID already has different content'});}
          return send(res,200,{feedback:await readJson(target)});
        }
      }
      return send(res,405,{error:'Method not allowed'});
    }catch(error){return send(res,error.code==='ENOENT'?404:409,{error:error.code==='ENOENT'?'Run not found':'Evidence unavailable or failed verification; no completed analysis can be shown.'});}
  });
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const server=await createVideoWorker({root:process.env.VIDEO_TEST_ROOT||'.video-analysis/testing',modulePath:process.env.VIDEO_ANALYZER_MODULE||'tools/video-analyzer/core.mjs',token:process.env.VIDEO_TEST_WORKER_TOKEN});
  server.listen(Number(process.env.PORT||8789),'127.0.0.1',()=>console.log('Video testing worker listening on loopback port '+server.address().port));
}
