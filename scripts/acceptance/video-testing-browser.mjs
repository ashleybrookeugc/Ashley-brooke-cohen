import {createServer} from 'node:http';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {handleVideoTesting,securityHeaders} from '../../src/video-testing/gateway.js';
import {createVideoWorker} from '../../tools/video-testing/server.mjs';

// Test-only synthetic fixture and loopback transport. No private media or live credentials.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const launchOptions={headless:true};
if(process.env.TEST_CHROMIUM_PACKAGE){const packaged=(await import(process.env.TEST_CHROMIUM_PACKAGE)).default;launchOptions.executablePath=await packaged.executablePath();launchOptions.args=packaged.args.filter(arg=>arg!=='--disable-web-security');}
const root=await mkdtemp(join(tmpdir(),'mk-browser-'));
const fixture=join(root,'synthetic.mp4');
execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=navy:s=160x120:r=12:d=1','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
const token=randomBytes(32).toString('hex'),workerToken=randomBytes(32).toString('hex');
const worker=await createVideoWorker({root:join(root,'jobs'),modulePath:resolve(process.env.VIDEO_ANALYZER_MODULE||'tools/video-analyzer/core.mjs'),token:workerToken});
await new Promise(r=>worker.listen(0,'127.0.0.1',r));
let offline=false;
const env={VIDEO_TEST_ACCESS_TOKEN:token,VIDEO_TEST_WORKER_TOKEN:workerToken,VIDEO_TEST_WORKER_URL:'https://synthetic-worker.invalid'};
const app=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost:'+app.address().port);
  let response;
  if(url.pathname.startsWith('/api/')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const request=new Request(url,{method:req.method,headers:req.headers,body:req.method==='POST'?Buffer.concat(chunks):undefined});
   response=await handleVideoTesting(request,env,{fetchImpl:async(target,options)=>{if(offline)throw Error('Synthetic disconnect');assert.equal(new URL(target).origin,env.VIDEO_TEST_WORKER_URL);return fetch('http://127.0.0.1:'+worker.address().port+new URL(target).pathname,options)}});
  }else{
   const files={'/video-test/':['index.html','text/html'],'/video-test/app.js':['app.js','text/javascript'],'/video-test/style.css':['style.css','text/css']};
   const file=files[url.pathname];response=file?new Response(await readFile(resolve('public/video-test',file[0])),{headers:{...securityHeaders,'content-type':file[1]}}):new Response('Not found',{status:404});
  }
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Test harness failure');}
});
await new Promise(r=>app.listen(0,'127.0.0.1',r));
const browser=await chromium.launch(launchOptions);
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('response',r=>{if(r.url().includes('/api/'))console.log('HTTP',r.status(),new URL(r.url()).pathname)});
 await page.goto('http://localhost:'+app.address().port+'/video-test/');
 await page.locator('#token').fill(token);await page.locator('#login button').click();
 try{await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Analyzer connected'),{},{timeout:10000});}catch(error){console.log('Connection diagnostic:',await page.locator('#status').textContent(),errors,(await context.cookies()).map(c=>({name:c.name,secure:c.secure})));throw error;}
 assert.equal((await context.cookies()).some(c=>c.name==='__Host-video_test'&&c.httpOnly&&c.secure),true);
 await page.locator('#file').setInputFiles(fixture);await page.locator('#analyze').click();
 await page.locator('#review').waitFor({state:'visible',timeout:30000});
 assert.match(await page.locator('#coverage').textContent(),/1.00 seconds/);
 assert.equal(await page.locator('#frames img').count(),1);
 await page.waitForFunction(()=>document.querySelector('#frames img')?.naturalWidth>0);
 await page.locator('#text').fill('Browser acceptance correction');await page.locator('#correction button').click();
 await page.waitForFunction(()=>document.getElementById('feedback').textContent.includes('Saved and retrieved'));
 await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Analyzer connected'));
 assert.equal(await page.locator('#access').isVisible(),false);
 await page.locator('#runs button').first().click();await page.locator('#review').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.getElementById('feedback').textContent.includes('Browser acceptance correction'));
 await page.waitForFunction(()=>document.getElementById('video').readyState>=1);
 await page.locator('#video').evaluate(v=>v.play());
 await page.screenshot({path:join(root,'mobile-review.png'),fullPage:true});
 offline=true;await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('unreachable'));
 await page.locator('#runs button').first().click();await page.locator('#review').waitFor({state:'visible'});
 await page.locator('#file').setInputFiles(fixture);await page.waitForFunction(()=>document.getElementById('selected').textContent.includes('exact source identity verified'));
 await page.locator('#text').fill('Offline browser correction');await page.locator('#correction button').click();
 await page.waitForFunction(()=>document.getElementById('feedback').textContent.includes('waiting to sync'));
 await page.reload();await page.waitForFunction(()=>document.getElementById('runs').children.length>0);await page.locator('#runs button').first().click();
 await page.waitForFunction(()=>document.getElementById('feedback').textContent.includes('Offline browser correction'));
 offline=false;await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('feedback').textContent.includes('waiting to sync'));
 assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log(JSON.stringify({status:'PASS',scope:'real Chromium mobile viewport; synthetic footage; real IndexedDB/cookie/upload/analyzer/frame/playback/correction/reload/offline/reconnect',physical_iPhone:'NOT_TESTED',live_Cloudflare:'NOT_TESTED',screenshot:join(root,'mobile-review.png')}));
}finally{await browser.close();await new Promise(r=>app.close(r));await new Promise(r=>worker.close(r));}
