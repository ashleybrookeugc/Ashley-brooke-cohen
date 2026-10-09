import {signWorkerTelemetry} from '../control/worker-telemetry.js';

export class WorkerTelemetryPublisherError extends Error {
  constructor(code,message){super(message);this.code=code;}
}

export function createCloudflareWorkerTelemetryPublisher({
  enabled=false,
  endpoint,
  secretProvider,
  fetchImpl=fetch,
  now=()=>Date.now(),
}={}) {
  const url=()=>{
    let parsed;
    try { parsed=new URL(endpoint); } catch { throw new WorkerTelemetryPublisherError('invalid_endpoint','The worker telemetry endpoint is invalid'); }
    if(parsed.protocol!=='https:'||parsed.pathname!=='/api/control/workers/telemetry') throw new WorkerTelemetryPublisherError('invalid_endpoint','Worker telemetry requires the approved HTTPS endpoint');
    return parsed;
  };
  return {
    get active(){return enabled===true;},
    async publish(snapshot) {
      if(enabled!==true) throw new WorkerTelemetryPublisherError('publisher_disabled','Worker telemetry publishing is disabled');
      const target=url();
      const secret=await secretProvider?.();
      if(typeof secret!=='string'||secret.length<32) throw new WorkerTelemetryPublisherError('credential_unavailable','Worker telemetry authentication is unavailable');
      const body=JSON.stringify(snapshot);
      if(body.length>65536) throw new WorkerTelemetryPublisherError('payload_too_large','Worker telemetry exceeded the bounded payload size');
      const timestamp=String(Math.floor(now()/1000));
      const signature=await signWorkerTelemetry(secret,timestamp,body);
      let response;
      try { response=await fetchImpl(target,{method:'POST',headers:{'content-type':'application/json','x-mk-telemetry-timestamp':timestamp,'x-mk-telemetry-signature':signature},body}); }
      catch { throw new WorkerTelemetryPublisherError('transport_unavailable','Mary Kate could not send the worker heartbeat'); }
      if(!response.ok) throw new WorkerTelemetryPublisherError('telemetry_rejected',`Mary Kate's worker heartbeat was rejected with HTTP ${response.status}`);
      return {accepted:true,status:response.status};
    },
  };
}
