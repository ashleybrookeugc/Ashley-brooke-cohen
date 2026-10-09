const encoder=new TextEncoder();
const STATES=new Set(['running','idle','completed','blocked','disconnected','unknown']);
const TELEMETRY_VERSION='mary-kate.worker-telemetry.v1';
const DEFAULT_FRESH_MS=20000;

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

function cleanWorker(worker) {
  const id=cleanString(worker?.id,180);
  const taskId=cleanString(worker?.task?.id,64);
  if(!id||!taskId) throw new Error('Worker identity is required');
  const state=STATES.has(worker?.state)?worker.state:'unknown';
  const telemetryStatus=worker?.telemetry?.status==='unavailable'?'unavailable':'available';
  return {
    id,
    task:{id:taskId,summary:cleanString(worker?.task?.summary,240)||'Task unavailable'},
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
  if(input?.version!=='mary-kate.local-workers.v1'||input?.read_only!==true||input?.enabled!==true) throw new Error('Unsupported telemetry envelope');
  if(!Array.isArray(input.workers)||input.workers.length>20) throw new Error('Worker inventory is invalid');
  const observedAt=cleanTime(input.observed_at);
  if(!observedAt) throw new Error('Telemetry observation time is invalid');
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

export async function verifyWorkerTelemetrySignature({secret,timestamp,signature,body,now=Date.now(),maxSkewMs=90000}) {
  const seconds=Number(timestamp);
  if(!Number.isInteger(seconds)||Math.abs(now-seconds*1000)>maxSkewMs) return false;
  try { return constantTimeEqual(await signWorkerTelemetry(secret,timestamp,body),signature); }
  catch { return false; }
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
      const workers=fresh?payload.workers:payload.workers.map(worker=>({...worker,state:'disconnected',outcome_verified:false,telemetry:{status:'unavailable',message:'The M4 worker connection is offline or stale.',diagnostic_code:'m4_connection_stale'}}));
      return {...payload,observed_at:payload.observed_at,connection:{state:fresh?'connected':'disconnected',fresh,last_received_at:row.received_at,expires_at:row.expires_at},workers};
    },
  };
}

export const WORKER_TELEMETRY_SCHEMA="CREATE TABLE IF NOT EXISTS control_worker_telemetry (source_id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,observed_at TEXT NOT NULL,received_at TEXT NOT NULL,expires_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS idx_control_worker_telemetry_expiry ON control_worker_telemetry(expires_at);";
