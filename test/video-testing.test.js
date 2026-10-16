import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {isAdmin} from '../src/admin-session.js';
import {handleVideoTesting,authorized,LIMIT} from '../src/video-testing/gateway.js';
import {createVideoWorker} from '../tools/video-testing/server.mjs';
const analyzerModule=resolve(process.env.VIDEO_ANALYZER_MODULE||'tools/video-analyzer/core.mjs');
const token='test-only-private-access-0123456789abcdef';
const env={ADMIN_SESSION_SECRET:token,VIDEO_TEST_WORKER_TOKEN:'different-worker-token-0123456789abcdef',VIDEO_TEST_WORKER_URL:'https://authorized-worker.example'};
const origin='https://test.example';
const request=(path,options={})=>new Request(origin+'/api/video-test'+path,options);
test('picture-description requests retain existing authentication, same-origin writes and fixed private transport',async()=>{
 const path='/jobs/00000000-0000-4000-8000-000000000000/describe';
 assert.equal((await handleVideoTesting(request(path,{method:'POST',headers:{origin}}),env)).status,401);
 assert.equal((await handleVideoTesting(request(path,{method:'POST',headers:{origin:'https://other.example'}}),env)).status,403);
 const cookie=await session();let called=false;
 const response=await handleVideoTesting(request(path,{method:'POST',headers:{origin,cookie}}),{...env,VIDEO_TEST_PRIVATE_SERVICE:{async fetch(url,options){called=true;assert.equal(url,'http://authorized-worker.example/video-worker'+path);assert.equal(options.headers.get('cookie'),null);assert.equal(options.headers.get('authorization'),'Bearer '+env.VIDEO_TEST_WORKER_TOKEN);return Response.json({visual_state:'running'},{status:202});}}},{fetchImpl:()=>{throw Error('No public fallback')}});
 assert.equal(called,true);assert.equal(response.status,202);
 assert.equal((await handleVideoTesting(request(path+'/anything',{method:'POST',headers:{origin,cookie}}),env)).status,404);
});
async function session(expires=Date.now()+28800000){
 const payload=Buffer.from(JSON.stringify({exp:expires})).toString('base64url');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))).toString('base64url');
 return 'abc_admin='+payload+'.'+signature;
}
test('existing Mary Kate session authorizes video without testing secrets; expired, forged and legacy cookies fail',async()=>{
 const cookie=await session();assert.equal(await authorized(request('/health',{headers:{cookie}}),env),true);
 assert.equal(await authorized(request('/health',{headers:{cookie}}),{...env,ADMIN_SESSION_SECRET:token+'rotated'}),false);
 assert.equal(await authorized(request('/health',{headers:{cookie}}),env,Date.now()+28800001),false);
 for(const bad of [await session(Date.now()-1),cookie+'forged',cookie+'.extra','abc_admin=invalid','__Host-video_test=legacy','admin_session=anything']){
  assert.equal(await authorized(request('/health',{headers:{cookie:bad}}),env),false);
  assert.equal((await handleVideoTesting(request('/jobs',{headers:{cookie:bad}}),env)).status,401);
 }
 const status=await handleVideoTesting(request('/session',{headers:{cookie}}),env);
 assert.deepEqual(await status.json(),{configured:true,authenticated:true});assert.equal(status.headers.get('set-cookie'),null);
 assert.deepEqual(await (await handleVideoTesting(request('/session'),env)).json(),{configured:true,authenticated:false});
 assert.equal((await handleVideoTesting(request('/jobs'),env)).status,401);
 assert.equal((await handleVideoTesting(request('/session',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify({token})}),env)).status,403);
 assert.equal((await handleVideoTesting(request('/session',{method:'POST',headers:{origin},body:JSON.stringify({token})}),env)).status,405);
 assert.equal((await handleVideoTesting(request('/jobs',{method:'POST',headers:{cookie},body:'x'}),env)).status,403);
 assert.equal((await handleVideoTesting(request('/jobs',{method:'POST',headers:{cookie,origin:'https://evil.example'},body:'x'}),env)).status,403);
});
test('gateway offline, path allowlist, upload cap, credential separation and redirect refusal',async()=>{
 const cookie=await session(),call=path=>request(path,{headers:{cookie}});
 assert.equal((await handleVideoTesting(call('/health'),{...env,VIDEO_TEST_WORKER_URL:''})).status,503);
 assert.equal((await handleVideoTesting(call('/admin'),env)).status,404);
 assert.equal((await handleVideoTesting(request('/jobs',{method:'POST',headers:{cookie,origin,'content-length':String(LIMIT+1)},body:'x'}),env)).status,413);
 const response=await handleVideoTesting(call('/health'),env,{fetchImpl:async(url,opts)=>{assert.equal(url,env.VIDEO_TEST_WORKER_URL+'/video-worker/health');assert.equal(opts.headers.get('cookie'),null);assert.equal(opts.headers.get('authorization'),'Bearer '+env.VIDEO_TEST_WORKER_TOKEN);return new Response(null,{status:302});}});
 assert.equal(response.status,502);
 assert.equal((await handleVideoTesting(call('/health'),env,{fetchImpl:async()=>{throw Error('offline')}})).status,503);
});
test('private service pins the transport while preserving the fixed path, bearer separation and range',async()=>{
 const cookie=await session();let calls=0;
 const privateEnv={...env,VIDEO_TEST_PRIVATE_SERVICE:{async fetch(target,options){
  calls++;assert.equal(this,privateEnv.VIDEO_TEST_PRIVATE_SERVICE);
  assert.equal(target,'http://authorized-worker.example/video-worker/health');
  assert.equal(options.headers.get('authorization'),'Bearer '+env.VIDEO_TEST_WORKER_TOKEN);
  assert.equal(options.headers.get('cookie'),null);assert.equal(options.headers.get('range'),'bytes=0-15');
  assert.equal(options.redirect,'manual');return new Response(JSON.stringify({state:'available'}));
 }}};
 const response=await handleVideoTesting(request('/health',{headers:{cookie,range:'bytes=0-15'}}),privateEnv,{fetchImpl(){throw Error('Public fallback forbidden')}});
 assert.equal(response.status,200);assert.equal(calls,1);
});
test('private failure, invalid binding and redirect fail closed without public fallback',async()=>{
 const cookie=await session();let publicCalls=0;
 for(const binding of [{fetch(){throw Error('Tunnel down')}},{fetch(){return new Response(null,{status:302})}},{}]){
  const response=await handleVideoTesting(request('/health',{headers:{cookie}}),{...env,VIDEO_TEST_PRIVATE_SERVICE:binding},{fetchImpl(){publicCalls++;return new Response('Unexpected')}});
  assert.ok([502,503].includes(response.status));
 }
 assert.equal(publicCalls,0);
});
test('ordinary HTTPS transport remains fixed and rejects insecure configured origins',async()=>{
 const cookie=await session();
 const response=await handleVideoTesting(request('/health?url=https://untrusted.example',{headers:{cookie}}),env,{fetchImpl(target){assert.equal(target,'https://authorized-worker.example/video-worker/health');return new Response('ok')}});
 assert.equal(response.status,200);
 assert.equal((await handleVideoTesting(request('/health',{headers:{cookie}}),{...env,VIDEO_TEST_WORKER_URL:'http://untrusted.example'})).status,503);
});
async function listen(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
async function close(server){await new Promise(r=>server.close(r));}
test('actual synthetic upload: unchanged analyzer, frames, source times, range playback, feedback restart and invalid-video failure',{skip:!existsSync(analyzerModule)?'Existing analyzer checkout required; no substitute analyzer':false},async t=>{
 const root=await mkdtemp(join(tmpdir(),'video-test-')),fixture=join(root,'synthetic.mp4');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=navy:s=160x120:r=12:d=1','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
 const options={root:join(root,'runs'),modulePath:analyzerModule,token:env.VIDEO_TEST_WORKER_TOKEN};
 let server=await createVideoWorker(options),base=await listen(server);t.after(()=>close(server));
 const send=(path,opts={})=>fetch(base+'/video-worker'+path,{...opts,headers:{authorization:'Bearer '+options.token,...opts.headers}});
 const wait=async id=>{let status;for(let i=0;i<200;i++){status=await send('/jobs/'+id).then(r=>r.json());if(status.state!=='running')return status;await new Promise(r=>setTimeout(r,100));}return status;};
 assert.equal((await fetch(base+'/video-worker/jobs')).status,401);
 assert.equal((await send('/health').then(r=>r.json())).state,'available');
 const upload=await send('/jobs',{method:'POST',body:await readFile(fixture)});assert.equal(upload.status,202);const job=await upload.json();
 assert.equal((await wait(job.id)).state,'completed');
 const result=await send('/jobs/'+job.id+'/result').then(r=>r.json());
 assert.equal(result.readback.verified,true);assert.equal(result.manifest.coverage.state,'source_decoded_end_to_end');assert.equal(result.manifest.safe_deletion_gate.safe_to_delete_original,false);
 assert.ok(result.manifest.coverage.visual_sampling.frames.length>0);
 const frame=await send('/jobs/'+job.id+'/frames/0');assert.equal(frame.status,200);assert.equal(frame.headers.get('content-type'),'image/jpeg');assert.ok((await frame.arrayBuffer()).byteLength>100);
 const media=await send('/jobs/'+job.id+'/media',{headers:{range:'bytes=0-15'}});assert.equal(media.status,206);assert.equal((await media.arrayBuffer()).byteLength,16);
 const feedback={id:randomUUID(),source_sha256:result.manifest.content_sha256,observation_id:'general',timestamp_seconds:0,text:'Synthetic fixture only, not a creative review.'};
 const post=body=>send('/jobs/'+job.id+'/feedback',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await post({...feedback,source_sha256:'wrong'})).status,409);assert.equal((await post({...feedback,observation_id:'wrong'})).status,409);
 assert.equal((await post(feedback)).status,200);assert.equal((await post(feedback)).status,200);assert.equal((await post({...feedback,text:'overwrite'})).status,409);
 await close(server);server=await createVideoWorker(options);base=await listen(server);
 const reread=await send('/jobs/'+job.id+'/feedback').then(r=>r.json());assert.equal(reread.feedback.length,1);assert.equal(reread.feedback[0].text,feedback.text);assert.equal((await send('/jobs/'+job.id+'/result')).status,200);
 const invalid=await send('/jobs',{method:'POST',body:'not a video'}).then(r=>r.json());assert.equal((await wait(invalid.id)).state,'failed');assert.equal((await send('/jobs/'+invalid.id+'/result')).status,409);
});
test('missing analyzer is unavailable; interrupted jobs become failed after restart',async t=>{
 const root=await mkdtemp(join(tmpdir(),'video-offline-')),id=randomUUID();await mkdir(join(root,id));await writeFile(join(root,id,'job.json'),JSON.stringify({id,state:'running'}));
 const server=await createVideoWorker({root,modulePath:join(root,'absent.mjs'),token}),base=await listen(server);t.after(()=>close(server));const headers={authorization:'Bearer '+token};
 assert.equal((await fetch(base+'/video-worker/health',{headers}).then(r=>r.json())).state,'unavailable');assert.equal((await fetch(base+'/video-worker/jobs/'+id,{headers}).then(r=>r.json())).state,'failed');assert.equal((await fetch(base+'/video-worker/jobs',{method:'POST',headers,body:'x'})).status,503);
});
test('a completed label is revoked when its evidence package fails verification',{skip:!existsSync(analyzerModule)?'Existing analyzer checkout required':false},async t=>{
 const root=await mkdtemp(join(tmpdir(),'video-corrupt-')),fixture=join(root,'synthetic.mp4');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=navy:s=160x120:r=12:d=1','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
 const server=await createVideoWorker({root:join(root,'runs'),modulePath:analyzerModule,token}),base=await listen(server);t.after(()=>close(server));
 const send=(path,opts={})=>fetch(base+'/video-worker'+path,{...opts,headers:{authorization:'Bearer '+token,...opts.headers}});
 const uploaded=await send('/jobs',{method:'POST',body:await readFile(fixture)});assert.equal(uploaded.status,202);const {id}=await uploaded.json();
 let job;for(let i=0;i<100;i++){job=await send('/jobs/'+id).then(r=>r.json());if(job.state!=='running')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(job.state,'completed');
 const stored=JSON.parse(await readFile(join(root,'runs',id,'result.json'),'utf8'));
 await writeFile(join(stored.package_directory,'evidence.json'),'{}');
 assert.equal((await send('/jobs/'+id+'/result')).status,409);
 job=await send('/jobs/'+id).then(r=>r.json());assert.equal(job.state,'failed');
 assert.match(job.error,/verification/i);
});
test('legacy testing credentials cannot unlock either administration or video; CI upload guard remains',async()=>{
 const headers={cookie:'__Host-video_test=legacy-testing-session'};
 assert.equal(await isAdmin(request('/health',{headers}),env),false);
 assert.equal(await authorized(request('/health',{headers}),env),false);
 assert.throws(()=>execFileSync(process.execPath,['scripts/video-testing-build-guard.mjs'],{env:{...process.env,CI:'true',VIDEO_TEST_DEPLOY_APPROVED:''},stdio:'pipe'}));
});
