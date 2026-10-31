const encoder=new TextEncoder();
const STATES=new Set(['running','idle','completed','blocked','disconnected','unknown']);
const PLAN_STEP_STATES=new Set(['completed','current','next','pending','blocked']);
const TELEMETRY_VERSION='mary-kate.worker-telemetry.v1';
const DEFAULT_FRESH_MS=20000;
const TIMESTAMP_SKEW_MS=90000;
const MAX_UNIX_SECONDS=10_000_000_000;

export class WorkerTelemetryPayloadError extends Error {
  constructor(message){super(message);this.name='WorkerTelemetryPayloadError';}
}

const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');

function constantTimeEqual(a,b) {
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length) return false;
  let different=0;
  for(let index=0;index<a.length;index++) different|=a.charCodeAt(index)^b.charCodeAt(index);
  return different===0;
}

function cleanString(value,max=240) {
  if(typeof value!=='string') return null;
  const clean=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
  return clean?clean.slice(0,max):null;
}

function cleanTime(value) {
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
}

function cleanMetric(value,depth=0) {
  if(value==null) return null;
  if(typeof value==='number'&&Number.isFinite(value)) return value;
  if(typeof value==='string') return value.slice(0,100);
  if(depth>1||typeof value!=='object'||Array.isArray(value)) return null;
  const entries=Object.entries(value).slice(0,12).map(([key,item])=>[cleanString(key,40),cleanMetric(item,depth+1)]).filter(([key,item])=>key&&item!==null);
  return entries.length?Object.fromEntries(entries):null;
}

function cleanEvent(event) {
  return {
    observed_at:cleanTime(event?.observed_at),
    source:event?.source==='herdr'?'herdr':'unknown',
    source_status:cleanString(event?.source_status,64)||'unknown',
    state:STATES.has(event?.state)?event.state:'unknown',
    state_change_seq:Number.isInteger(event?.state_change_seq)?event.state_change_seq:null,
    completion_seq:Number.isInteger(event?.completion_seq)?event.completion_seq:null,
    revision:Number.isInteger(event?.revision)?event.revision:null,
  };
}

function cleanPlan(plan) {
  if(!plan||typeof plan!=='object'||Array.isArray(plan)) return null;
  const goal=cleanString(plan.goal,240);
  const steps=Array.isArray(plan.steps)?plan.steps.slice(0,8).map(step=>{
    const label=cleanString(step?.label,200);
    const state=PLAN_STEP_STATES.has(step?.state)?step.state:null;
    return label&&state?{label,state}:null;
  }).filter(Boolean):[];
  if(!goal||!steps.length||!steps.some(step=>step.state==='current'||step.state==='next')) return null;
  return {goal,steps,updated_at:cleanTime(plan.updated_at)};
}

function cleanWorker(worker) {
  const id=cleanString(worker?.id,180);
  const taskId=cleanString(worker?.task?.id,64);
  if(!id||!taskId) throw new WorkerTelemetryPayloadError('Worker identity is required');
  const state=STATES.has(worker?.state)?worker.state:'unknown';
  const telemetryStatus=worker?.telemetry?.status==='unavailable'?'unavailable':'available';
  return {
    id,
    task:{id:taskId,summary:cleanString(worker?.task?.summary,240)||'Task unavailable',project_id:/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(worker?.task?.project_id||'')&&worker.task.project_id.length<=100?worker.task.project_id:null},
    state,
    state_source:worker?.state_source==='herdr'?'herdr':'unknown',
    outcome_verified:false,
    runtime_metrics:{
      model:cleanMetric(worker?.runtime_metrics?.model),
      tokens:cleanMetric(worker?.runtime_metrics?.tokens),
      cost:cleanMetric(worker?.runtime_metrics?.cost),
    },
    last_observed_at:cleanTime(worker?.last_observed_at),
    progress_events:Array.isArray(worker?.progress_events)?worker.progress_events.slice(-20).map(cleanEvent):[],
    plan:cleanPlan(worker?.plan),
    identity:{
      session:cleanString(worker?.identity?.session,80),
      workspace_id:cleanString(worker?.identity?.workspace_id,100),
      pane_id:cleanString(worker?.identity?.pane_id,100),
      agent_name:cleanString(worker?.identity?.agent_name,64),
    },
    ...(telemetryStatus==='unavailable'?{telemetry:{status:'unavailable',message:'Worker telemetry is temporarily unavailable.',diagnostic_code:cleanString(worker?.telemetry?.diagnostic_code,64)||'observation_failed'}}:{}),
  };
}

export function normalizeWorkerTelemetry(input,{receivedAt=new Date().toISOString()}={}) {
  if(input?.version!=='mary-kate.local-workers.v1'||input?.read_only!==true||input?.enabled!==true) throw new WorkerTelemetryPayloadError('Unsupported telemetry envelope');
  if(!Array.isArray(input.workers)||input.workers.length>20) throw new WorkerTelemetryPayloadError('Worker inventory is invalid');
  const observedAt=cleanTime(input.observed_at);
  if(!observedAt) throw new WorkerTelemetryPayloadError('Telemetry observation time is invalid');
  return {
    version:TELEMETRY_VERSION,
    source_id:'m4-herdr',
    enabled:true,
    read_only:true,
    observed_at:observedAt,
    received_at:cleanTime(receivedAt),
    configuration_integrity:input.configuration_integrity==='matched'?'matched':'unavailable',
    workers:input.workers.map(cleanWorker),
  };
}

export async function signWorkerTelemetry(secret,timestamp,body) {
  if(typeof secret!=='string'||secret.length<32) throw new Error('Telemetry credential is unavailable');
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return base64url(await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}.${body}`)));
}

function unauthorized(reason) {
  return {ok:false,status:401,code:'worker_telemetry_unauthorized',reason};
}

export function workerTelemetryVersionId(env) {
  const id=env?.WORKER_VERSION?.id;
  return typeof id==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(id)?id:null;
}

export async function inspectWorkerTelemetrySignature({secret,timestamp,signature,body,now=Date.now(),maxSkewMs=TIMESTAMP_SKEW_MS}={}) {
  if(typeof secret!=='string'||secret.length===0) return {ok:false,status:503,code:'worker_telemetry_not_configured',reason:'missing_secret'};
  if(secret.length<32) return unauthorized('credential_unusable');
  if(timestamp==null||timestamp==='') return unauthorized('missing_timestamp');
  if(typeof timestamp!=='string'||!/^[0-9]{1,16}$/.test(timestamp)) return unauthorized('timestamp_invalid');
  const seconds=Number(timestamp);
  if(!Number.isSafeInteger(seconds)) return unauthorized('timestamp_invalid');
  if(seconds>MAX_UNIX_SECONDS) return unauthorized('timestamp_unit');
  if(Math.abs(now-seconds*1000)>maxSkewMs) return unauthorized('timestamp_skew');
  if(typeof signature!=='string'||signature.length===0) return unauthorized('missing_signature');
  try {
    const expected=await signWorkerTelemetry(secret,timestamp,body);
    if(!constantTimeEqual(expected,signature)) return unauthorized('signature_mismatch');
  } catch { return unauthorized('signature_mismatch'); }
  return {ok:true};
}

export async function verifyWorkerTelemetrySignature(input) {
  return (await inspectWorkerTelemetrySignature(input)).ok===true;
}

function telemetryResponse(env,body,status) {
  const versionId=workerTelemetryVersionId(env);
  const payload=versionId?{...body,version_id:versionId}:body;
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
}

export async function handleWorkerTelemetryRequest(request,env,{ensureSchema=async()=>{},now=()=>Date.now()}={}) {
  if(request.method!=='POST') return telemetryResponse(env,{error:'Method not allowed',code:'read_only'},405);
  const raw=await request.text();
  if(raw.length>65536) return telemetryResponse(env,{error:'Worker telemetry payload is too large',code:'worker_telemetry_payload_too_large'},413);
  const clock=now();
  const verdict=await inspectWorkerTelemetrySignature({secret:env?.CONTROL_WORKER_TELEMETRY_SECRET,timestamp:request.headers.get('x-mk-telemetry-timestamp'),signature:request.headers.get('x-mk-telemetry-signature'),body:raw,now:clock});
  if(!verdict.ok) {
    const error=verdict.status===503?'Worker telemetry is not configured':'Unauthorized';
    return telemetryResponse(env,{error,code:verdict.code,reason:verdict.reason},verdict.status);
  }
  let payload;
  try { payload=JSON.parse(raw); }
  catch { return telemetryResponse(env,{error:'Valid JSON body required',code:'worker_telemetry_invalid'},400); }
  try { normalizeWorkerTelemetry(payload); }
  catch(error) {
    if(error instanceof WorkerTelemetryPayloadError) return telemetryResponse(env,{error:'Worker telemetry payload is invalid',code:'worker_telemetry_invalid'},400);
    throw error;
  }
  try {
    await ensureSchema(env);
    const stored=await createWorkerTelemetryStore(env.DB,{now:()=>new Date(clock).toISOString()}).put(payload);
    return telemetryResponse(env,stored,202);
  } catch(error) {
    if(error instanceof WorkerTelemetryPayloadError) return telemetryResponse(env,{error:'Worker telemetry payload is invalid',code:'worker_telemetry_invalid'},400);
    return telemetryResponse(env,{error:'Worker telemetry could not be stored',code:'worker_telemetry_store_unavailable'},503);
  }
}

export function createWorkerTelemetryStore(db,{now=()=>new Date().toISOString(),freshMs=DEFAULT_FRESH_MS}={}) {
  return {
    async put(payload) {
      const receivedAt=now();
      const normalized=normalizeWorkerTelemetry(payload,{receivedAt});
      const expiresAt=new Date(Date.parse(receivedAt)+freshMs).toISOString();
      await db.prepare('INSERT INTO control_worker_telemetry (source_id,payload_json,observed_at,received_at,expires_at) VALUES (?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET payload_json=excluded.payload_json,observed_at=excluded.observed_at,received_at=excluded.received_at,expires_at=excluded.expires_at').bind(normalized.source_id,JSON.stringify(normalized),normalized.observed_at,receivedAt,expiresAt).run();
      return {accepted:true,source_id:normalized.source_id,received_at:receivedAt,expires_at:expiresAt};
    },
    async read() {
      const row=await db.prepare('SELECT payload_json,observed_at,received_at,expires_at FROM control_worker_telemetry WHERE source_id=?').bind('m4-herdr').first();
      if(!row) return {version:TELEMETRY_VERSION,enabled:true,read_only:true,observed_at:now(),connection:{state:'disconnected',fresh:false,last_received_at:null},workers:[]};
      const payload=JSON.parse(row.payload_json);
      const fresh=Date.parse(row.expires_at)>Date.parse(now());
      const workers=fresh?payload.workers:payload.workers.map(worker=>({...worker,state:'disconnected',outcome_verified:false,plan:worker.plan?{...worker.plan,stale:true}:null,telemetry:{status:'unavailable',message:'The M4 worker connection is offline or stale.',diagnostic_code:'m4_connection_stale'}}));
      return {...payload,observed_at:payload.observed_at,connection:{state:fresh?'connected':'disconnected',fresh,last_received_at:row.received_at,expires_at:row.expires_at},workers};
    },
  };
}

export const WORKER_TELEMETRY_SCHEMA="CREATE TABLE IF NOT EXISTS control_worker_telemetry (source_id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,observed_at TEXT NOT NULL,received_at TEXT NOT NULL,expires_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS idx_control_worker_telemetry_expiry ON control_worker_telemetry(expires_at);";
