import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerTelemetryStore,normalizeWorkerTelemetry,signWorkerTelemetry,verifyWorkerTelemetrySignature} from '../src/control/worker-telemetry.js';
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
});
