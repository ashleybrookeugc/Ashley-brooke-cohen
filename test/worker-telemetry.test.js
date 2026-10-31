import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorkerTelemetryStore,handleWorkerTelemetryRequest,inspectWorkerTelemetrySignature,normalizeWorkerTelemetry,signWorkerTelemetry,verifyWorkerTelemetrySignature} from '../src/control/worker-telemetry.js';
import {createCloudflareWorkerTelemetryPublisher} from '../src/local-workers/cloudflare-telemetry.js';

const secret='test-only-telemetry-secret-that-is-never-production';
const worker={
  id:'herdr:mk:w1:worker',
  task:{id:'display-test',summary:'Display one real worker'},
  state:'running',
  state_source:'herdr',
  outcome_verified:false,
  runtime_metrics:{model:null,tokens:null,cost:null},
  last_observed_at:'2026-10-09T12:00:00.000Z',
  progress_events:[{observed_at:'2026-10-09T12:00:00.000Z',source:'herdr',source_status:'working',state:'running',state_change_seq:2,completion_seq:null,revision:2}],
  plan:{goal:'Verify the command-center plan display.',steps:[{label:'Read the current worker state.',state:'completed'},{label:'Publish the compact plan.',state:'current'},{label:'Reread the worker receipt.',state:'next'}],updated_at:'2026-10-09T12:00:00.000Z'},
  identity:{session:'mk',workspace_id:'w1',pane_id:'w1:p1',agent_name:'worker'},
};
const envelope={version:'mary-kate.local-workers.v1',enabled:true,read_only:true,observed_at:'2026-10-09T12:00:01.000Z',configuration_integrity:'matched',workers:[worker]};

function memoryDb() {
  let row=null;
  return {prepare(sql){let values=[];return{bind(...args){values=args;return this;},async run(){if(sql.startsWith('INSERT INTO control_worker_telemetry')) row={payload_json:values[1],observed_at:values[2],received_at:values[3],expires_at:values[4]};return{success:true};},async first(){return row;}};}};
}

test('signed heartbeat accepts the exact body and rejects tampering or stale timestamps',async()=>{
  const body=JSON.stringify(envelope),timestamp='1791547200';
  const signature=await signWorkerTelemetry(secret,timestamp,body);
  assert.equal(await verifyWorkerTelemetrySignature({secret,timestamp,signature,body,now:1791547200000}),true);
  assert.equal(await verifyWorkerTelemetrySignature({secret,timestamp,signature,body:body+' ',now:1791547200000}),false);
  assert.equal(await verifyWorkerTelemetrySignature({secret,timestamp,signature,body,now:1791547400000}),false);
});

test('telemetry allowlist cannot transmit credentials or claim verified output',()=>{
  const normalized=normalizeWorkerTelemetry({...envelope,private_key:'PRIVATE_KEY_MARKER',workers:[{...worker,outcome_verified:true,authorization:'Bearer TOKEN_MARKER',identity:{...worker.identity,secret:'SECRET_MARKER'}}]},{receivedAt:'2026-10-09T12:00:02.000Z'});
  const text=JSON.stringify(normalized);
  assert.equal(normalized.workers[0].outcome_verified,false);
  assert.equal(normalized.configuration_integrity,'matched');
  assert.doesNotMatch(text,/PRIVATE_KEY_MARKER|TOKEN_MARKER|SECRET_MARKER|authorization|private_key/i);
});

test('project association is exact and bounded without trusting arbitrary task fields',()=>{
  const normalized=normalizeWorkerTelemetry({...envelope,workers:[{...worker,task:{...worker.task,project_id:'mary-kate-ai-operating-system',secret:'TOKEN_MARKER'}}]});
  assert.equal(normalized.workers[0].task.project_id,'mary-kate-ai-operating-system');
  assert.doesNotMatch(JSON.stringify(normalized),/TOKEN_MARKER/);
  const invalid=normalizeWorkerTelemetry({...envelope,workers:[{...worker,task:{...worker.task,project_id:'../../other-project'}}]});
  assert.equal(invalid.workers[0].task.project_id,null);
});

test('fresh D1 telemetry is connected and an expired snapshot becomes disconnected',async()=>{
  let current='2026-10-09T12:00:02.000Z';
  const store=createWorkerTelemetryStore(memoryDb(),{now:()=>current,freshMs:20000});
  await store.put(envelope);
  const fresh=await store.read();
  assert.equal(fresh.connection.state,'connected');
  assert.equal(fresh.workers[0].state,'running');
  current='2026-10-09T12:00:23.000Z';
  const stale=await store.read();
  assert.equal(stale.connection.state,'disconnected');
  assert.equal(stale.workers[0].state,'disconnected');
  assert.equal(stale.workers[0].telemetry.diagnostic_code,'m4_connection_stale');
  assert.equal(stale.workers[0].plan.stale,true);
});

test('task plans are bounded, plain, and cannot carry arbitrary telemetry fields',()=>{
  const normalized=normalizeWorkerTelemetry({...envelope,workers:[{...worker,plan:{goal:'Show a clear checklist.',steps:[{label:'Finished',state:'completed',secret:'TOKEN_MARKER'},{label:'Working now',state:'current'},{label:'Next',state:'next'}],updated_at:'2026-10-09T12:00:00.000Z',private_key:'PRIVATE_KEY_MARKER'}}]},{receivedAt:'2026-10-09T12:00:02.000Z'});
  assert.deepEqual(normalized.workers[0].plan.steps.map(step=>step.state),['completed','current','next']);
  assert.doesNotMatch(JSON.stringify(normalized.workers[0].plan),/TOKEN_MARKER|PRIVATE_KEY_MARKER/);
});

test('publisher is disabled by default and sends one bounded signed HTTPS heartbeat when enabled',async()=>{
  const disabled=createCloudflareWorkerTelemetryPublisher();
  await assert.rejects(disabled.publish(envelope),error=>error.code==='publisher_disabled');
  let request;
  const publisher=createCloudflareWorkerTelemetryPublisher({enabled:true,endpoint:'https://ashleybrookecohen.com/api/control/workers/telemetry',secretProvider:async()=>secret,now:()=>1791547200000,fetchImpl:async(url,options)=>{request={url:String(url),options};return new Response('{}',{status:202});}});
  assert.deepEqual(await publisher.publish(envelope),{accepted:true,status:202});
  assert.equal(request.url,'https://ashleybrookecohen.com/api/control/workers/telemetry');
  assert.equal(request.options.method,'POST');
  assert.equal(await verifyWorkerTelemetrySignature({secret,timestamp:request.options.headers['x-mk-telemetry-timestamp'],signature:request.options.headers['x-mk-telemetry-signature'],body:request.options.body,now:1791547200000}),true);
  assert.doesNotMatch(JSON.stringify(request.options),new RegExp(secret));
});

test('publisher errors never include a credential or remote response body',async()=>{
  const publisher=createCloudflareWorkerTelemetryPublisher({enabled:true,endpoint:'https://ashleybrookecohen.com/api/control/workers/telemetry',secretProvider:async()=>secret,fetchImpl:async()=>new Response('PRIVATE TOKEN '+secret,{status:401})});
  await assert.rejects(publisher.publish(envelope),error=>error.code==='telemetry_rejected'&&!error.message.includes(secret)&&!error.message.includes('PRIVATE TOKEN'));
  const coded=createCloudflareWorkerTelemetryPublisher({enabled:true,endpoint:'https://ashleybrookecohen.com/api/control/workers/telemetry',secretProvider:async()=>secret,fetchImpl:async()=>new Response(JSON.stringify({error:'Unauthorized',code:'worker_telemetry_unauthorized',reason:'signature_mismatch',leak:secret}),{status:401})});
  await assert.rejects(coded.publish(envelope),error=>error.code==='telemetry_rejected'&&error.message.includes('HTTP 401 worker_telemetry_unauthorized signature_mismatch')&&!error.message.includes(secret));
});

const clock=1791547200000;
const endpoint='https://ashleybrookecohen.com/api/control/workers/telemetry';

async function capturePublish(snapshot=envelope,secretValue=secret,nowMs=clock) {
  let captured;
  const publisher=createCloudflareWorkerTelemetryPublisher({enabled:true,endpoint,secretProvider:async()=>secretValue,now:()=>nowMs,fetchImpl:async(url,options)=>{captured={url:String(url),options};return new Response('{}',{status:202});}});
  await publisher.publish(snapshot);
  return captured;
}

function postedRequest(captured,headers=captured.options.headers) {
  return new Request(captured.url,{method:'POST',headers,body:captured.options.body});
}

async function postTelemetry(request,env,ensureSchema=async()=>{},nowMs=clock) {
  const response=await handleWorkerTelemetryRequest(request,env,{ensureSchema,now:()=>nowMs});
  return {status:response.status,body:await response.json()};
}

test('signed publisher bytes are accepted before D1, then expire after 20 seconds',async()=>{
  const captured=await capturePublish();
  let schemaCalls=0;
  const db=memoryDb();
  const accepted=await postTelemetry(postedRequest(captured),{CONTROL_WORKER_TELEMETRY_SECRET:secret,DB:db,WORKER_VERSION:{id:'version-under-test'}},async()=>{schemaCalls+=1;});
  assert.equal(accepted.status,202);
  assert.equal(accepted.body.accepted,true);
  assert.equal(accepted.body.version_id,'version-under-test');
  assert.equal(schemaCalls,1);
  assert.equal(accepted.body.source_id,'m4-herdr');
  const fresh=await createWorkerTelemetryStore(db,{now:()=>new Date(clock).toISOString(),freshMs:20000}).read();
  assert.equal(fresh.connection.state,'connected');
  assert.equal(fresh.workers[0].state,'running');
  const stale=await createWorkerTelemetryStore(db,{now:()=>new Date(clock+20001).toISOString(),freshMs:20000}).read();
  assert.equal(stale.connection.state,'disconnected');
  assert.equal(stale.workers[0].state,'disconnected');
  assert.equal(stale.workers[0].telemetry.diagnostic_code,'m4_connection_stale');
});

test('telemetry route separates missing secret, signature mismatch, clock units, and D1 failure',async()=>{
  const captured=await capturePublish();
  let schemaCalls=0;
  const ensureSchema=async()=>{schemaCalls+=1;};
  const missing=await postTelemetry(postedRequest(await capturePublish()),{DB:memoryDb()},ensureSchema);
  assert.deepEqual({status:missing.status,code:missing.body.code,reason:missing.body.reason},{status:503,code:'worker_telemetry_not_configured',reason:'missing_secret'});
  assert.equal(schemaCalls,0);
  const mismatch=await postTelemetry(postedRequest(captured),{CONTROL_WORKER_TELEMETRY_SECRET:secret+'y'},ensureSchema);
  assert.equal(mismatch.status,401);
  assert.equal(mismatch.body.code,'worker_telemetry_unauthorized');
  assert.equal(mismatch.body.reason,'signature_mismatch');
  assert.equal(schemaCalls,0);
  const newline=await postTelemetry(postedRequest(await capturePublish(envelope,secret+'\n')),{CONTROL_WORKER_TELEMETRY_SECRET:secret},ensureSchema);
  assert.equal(newline.body.reason,'signature_mismatch');
  const skewed=await postTelemetry(postedRequest(await capturePublish(envelope,secret,clock-91000)),{CONTROL_WORKER_TELEMETRY_SECRET:secret},ensureSchema);
  assert.equal(skewed.body.reason,'timestamp_skew');
  const milliseconds=String(clock);
  const body=JSON.stringify(envelope);
  const signature=await signWorkerTelemetry(secret,milliseconds,body);
  const unit=await postTelemetry(new Request(endpoint,{method:'POST',headers:{'X-Mk-Telemetry-Timestamp':milliseconds,'X-Mk-Telemetry-Signature':signature},body}),{CONTROL_WORKER_TELEMETRY_SECRET:secret},ensureSchema);
  assert.equal(unit.body.reason,'timestamp_unit');
  const unsigned=await postTelemetry(new Request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{CONTROL_WORKER_TELEMETRY_SECRET:secret},ensureSchema);
  assert.equal(unsigned.body.reason,'missing_timestamp');
  const short=await postTelemetry(postedRequest(captured),{CONTROL_WORKER_TELEMETRY_SECRET:'x'.repeat(31)},ensureSchema);
  assert.equal(short.body.reason,'credential_unusable');
  assert.equal(schemaCalls,0);
  const sameNewline=await postTelemetry(postedRequest(await capturePublish(envelope,secret+'\n')),{CONTROL_WORKER_TELEMETRY_SECRET:secret+'\n',DB:memoryDb()},ensureSchema);
  assert.equal(sameNewline.status,202);
  const boundary=await postTelemetry(postedRequest(await capturePublish(envelope,secret,clock-90000)),{CONTROL_WORKER_TELEMETRY_SECRET:secret,DB:memoryDb()},ensureSchema);
  assert.equal(boundary.status,202);
  assert.equal(schemaCalls,2);
  const invalid=await postTelemetry(postedRequest(await capturePublish({version:'diagnostic-invalid'})),{CONTROL_WORKER_TELEMETRY_SECRET:secret,DB:memoryDb()},ensureSchema);
  assert.equal(invalid.status,400);
  assert.equal(invalid.body.code,'worker_telemetry_invalid');
  assert.equal(schemaCalls,2);
  const brokenDb={prepare(){return {bind(){return this;},async run(){throw new Error('D1 exploded '+secret);}};}};
  const stored=await postTelemetry(postedRequest(await capturePublish()),{CONTROL_WORKER_TELEMETRY_SECRET:secret,DB:brokenDb,WORKER_VERSION:{id:'version-under-test'}},ensureSchema);
  assert.equal(schemaCalls,3);
  assert.equal(stored.status,503);
  assert.equal(stored.body.code,'worker_telemetry_store_unavailable');
  assert.equal(stored.body.version_id,'version-under-test');
  assert.equal(JSON.stringify(stored.body).includes(secret),false);
  assert.equal(JSON.stringify(stored.body).includes('exploded'),false);
  const get=await postTelemetry(new Request(endpoint,{method:'GET'}),{CONTROL_WORKER_TELEMETRY_SECRET:secret},ensureSchema);
  assert.equal(get.status,405);
  assert.equal(get.body.code,'read_only');
});

test('login gate and legacy worker catch do not own the telemetry route',async()=>{
  const router=await readFile(new URL('../src/router-worker.js',import.meta.url),'utf8');
  const video=await readFile(new URL('../src/video-testing/page-worker.js',import.meta.url),'utf8');
  const legacy=await readFile(new URL('../src/worker.js',import.meta.url),'utf8');
  assert.match(router,/videoTestingRoute/);
  assert.doesNotMatch(router,/workers\/telemetry/);
  assert.match(router,/return app\.fetch\(request, env, ctx\)/);
  assert.doesNotMatch(video,/workers\/telemetry|CONTROL_WORKER_TELEMETRY_SECRET/);
  assert.match(legacy,/Temporarily unavailable\. Please try again\./);
  assert.doesNotMatch(legacy,/worker_telemetry_not_configured|worker_telemetry_unauthorized/);
  const verdict=await inspectWorkerTelemetrySignature({secret,timestamp:'not-a-time',signature:'abc',body:'{}',now:clock});
  assert.equal(verdict.reason,'timestamp_invalid');
  assert.equal(await verifyWorkerTelemetrySignature({secret,timestamp:'1791547200',signature:'not-the-signature',body:'{}',now:clock}),false);
});
