import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {handleVideoTesting,authorized,LIMIT} from '../src/video-testing/gateway.js';
import {createVideoWorker} from '../tools/video-testing/server.mjs';
const analyzerModule=resolve(process.env.VIDEO_ANALYZER_MODULE||'tools/video-analyzer/core.mjs');
const token='test-only-private-access-0123456789abcdef';
const env={VIDEO_TEST_ACCESS_TOKEN:token,VIDEO_TEST_WORKER_TOKEN:'different-worker-token-0123456789abcdef',VIDEO_TEST_WORKER_URL:'https://authorized-worker.example'};
const origin='https://test.example';
const request=(path,options={})=>new Request(origin+'/api/video-test'+path,options);
async function session(){const result=await handleVideoTesting(request('/session',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token})}),env);assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);return result.headers.get('set-cookie').split(';')[0];}
test('testing session is signed, expiring, revocable; admin cookies, CSRF and anonymous calls denied',async()=>{
 const cookie=await session();assert.equal(await authorized(request('/health',{headers:{cookie}}),env),true);
 assert.equal(await authorized(request('/health',{headers:{cookie}}),{...env,VIDEO_TEST_ACCESS_TOKEN:token+'rotated'}),false);
 assert.equal(await authorized(request('/health',{headers:{cookie}}),env,Date.now()+32*86400000),false);
 assert.equal(await authorized(request('/health',{headers:{cookie:'admin_session=anything'}}),env),false);
 assert.equal((await handleVideoTesting(request('/jobs'),env)).status,401);
 assert.equal((await handleVideoTesting(request('/session',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify({token})}),env)).status,403);
 assert.equal((await handleVideoTesting(request('/session',{method:'POST',headers:{origin},body:JSON.stringify({token:'wrong'})}),env)).status,401);
 assert.equal((await handleVideoTesting(request('/jobs',{method:'POST',headers:{cookie},body:'x'}),env)).status,403);
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
test('testing session cannot unlock production administration; CI upload guard stops unapproved builds',async()=>{
 const authSource=(await readFile(new URL('../src/auth-worker.js',import.meta.url),'utf8')).split('function json(')[0].replace(/import app[^;]+;/,'').replace('export async function isAdmin','async function isAdmin');
 const isAdmin=new Function(authSource+'; return isAdmin;')();const cookie=await session();
 assert.equal(await isAdmin(request('/health',{headers:{cookie}}),{ADMIN_SESSION_SECRET:'production-admin-secret'}),false);
 assert.throws(()=>execFileSync(process.execPath,['scripts/video-testing-build-guard.mjs'],{env:{...process.env,CI:'true',VIDEO_TEST_DEPLOY_APPROVED:''},stdio:'pipe'}));
});
