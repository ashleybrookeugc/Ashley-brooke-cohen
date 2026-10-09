import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const CONTROL_PAGE=new URL('../../public/control/index.html',import.meta.url);

function json(response,status=200) {
  return {status,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(response)};
}

function send(res,{status,headers,body}) {
  res.writeHead(status,headers);
  res.end(body);
}

export function createLocalWorkerControlInterface({
  enabled=false,
  adapter,
  host='127.0.0.1',
  port=0,
  controlPageUrl=CONTROL_PAGE,
  now=()=>new Date().toISOString(),
  onSnapshot=()=>{},
}={}) {
  let server;

  async function workersResponse() {
    if(enabled!==true) return json({version:'mary-kate.local-workers.v1',enabled:false,read_only:true,observed_at:now(),workers:[]});
    if(!adapter||typeof adapter.list!=='function') return json({error:'Local worker monitoring is not configured.',code:'worker_monitor_not_configured'},503);
    try {
      const response={version:'mary-kate.local-workers.v1',enabled:true,read_only:true,observed_at:now(),workers:await adapter.list()};
      onSnapshot(structuredClone(response));
      return json(response);
    } catch(error) {
      const diagnosticCode=typeof error?.code==='string'&&/^[a-z0-9_]{1,64}$/.test(error.code)?error.code:'worker_observation_failed';
      return json({error:'Mary Kate could not read local worker activity right now.',code:'worker_telemetry_unavailable',technical:{diagnostic_code:diagnosticCode}},503);
    }
  }

  async function handle(req,res) {
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&(url.pathname==='/control'||url.pathname==='/control/')) {
      send(res,{status:200,headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store'},body:await readFile(controlPageUrl,'utf8')});
      return;
    }
    if(url.pathname==='/api/control/workers') {
      if(req.method!=='GET') { send(res,json({error:'This local worker view is read-only.',code:'read_only'},405));return; }
      send(res,await workersResponse());
      return;
    }
    if(url.pathname==='/api/control/state') {
      send(res,json({error:'Project Truth state is not connected in this local worker-only view.',code:'local_worker_view_only'},503));
      return;
    }
    send(res,json({error:'Not found'},404));
  }

  return {
    get active(){return Boolean(server);},
    async start() {
      if(server) throw new Error('Local worker interface is already running');
      server=createServer((req,res)=>handle(req,res).catch(()=>send(res,json({error:'The local Mary Kate view could not load.',code:'local_interface_error'},500))));
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
      const address=server.address();
      return {url:`http://${host}:${address.port}/control/`,host,address:address.address,port:address.port,enabled:enabled===true,read_only:true};
    },
    async stop() {
      if(!server) return;
      const current=server;
      server=undefined;
      await new Promise((resolve,reject)=>current.close(error=>error?reject(error):resolve()));
    },
  };
}
