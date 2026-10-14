import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {createConversationTestSurface} from '../src/control/conversation-test-surface.js';

const corpus=JSON.parse(await readFile(new URL('../scripts/acceptance/conversation-holdouts.json',import.meta.url),'utf8'));
const page=await readFile(new URL('../public/control/conversation-test/index.html',import.meta.url),'utf8');
const origin='https://fixture.invalid';
const entry=corpus.supplements[0].cases[1];
const req=(data={case_id:entry.id},headers={})=>new Request(origin+'/api/control/conversation-test',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(data)});
function setup({authorized=true,missing=false,throwing=false}={}) {
  let calls=0,request;
  const env=new Proxy({}, {get(_target,key){if(key==='AI')return missing?undefined:{run:async(_model,r)=>{calls++;request=r;if(throwing)throw new Error('Bearer credential-must-not-leak');return r.tools?{tool_calls:[{name:'submit_control_route',arguments:{route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary:'Controlled transport probe; no semantic verdict.'}}]}:{response:'Controlled transport probe; no semantic verdict.'};}};if(key==='CONTROL_WORKERS_AI_MODEL')return undefined;throw new Error('Forbidden production binding accessed: '+String(key));}});
  const handle=createConversationTestSurface({corpus,page,revision:{kind:'unit transport probe'},authorize:async()=>authorized});
  return {env,handle,get calls(){return calls;},get request(){return request;}};
}

test('test surface authenticates before inspecting any runtime binding',async()=>{
  const f=setup({authorized:false});
  assert.equal((await f.handle(req(),f.env)).status,401);
  const denied=await f.handle(new Request(origin+'/control/conversation-test/'),f.env);
  assert.equal(denied.status,303);assert.equal(denied.headers.get('location'),'/admin/login');assert.equal(f.calls,0);
});
test('case listing and page rendering have no inference or production storage effects',async()=>{
  const f=setup();const listed=await f.handle(new Request(origin+'/api/control/conversation-test'),f.env);
  assert.equal((await listed.json()).cases.length,7);assert.equal(f.calls,0);
  const rendered=await f.handle(new Request(origin+'/control/conversation-test/'),f.env);
  assert.equal(await rendered.text(),page);assert.match(rendered.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.equal(await f.handle(new Request(origin+'/api/control/state'),f.env),null);
});
test('one frozen case uses actual service/provider adapters and zero production capabilities',async()=>{
  const f=setup();const result=await f.handle(req(),f.env);assert.equal(result.status,200);const receipt=await result.json();
  assert.equal(f.calls,1);assert.equal(receipt.actual.inference_calls,1);assert.equal(receipt.result,'BLOCKED_SEMANTIC_REVIEW');
  assert.deepEqual(receipt.actual.completed_state_changes.canonical,[]);
  assert.equal(receipt.deterministic_checks.exact_preceding_turns,true);
  assert.ok(!JSON.stringify(f.request).includes(entry.expected),'expected answer must stay outside model input');
});
test('custom prompts, models, cross-origin requests and oversized input never dispatch',async()=>{
  const f=setup();
  assert.equal((await f.handle(req({case_id:entry.id,input:'new prompt'}),f.env)).status,400);
  assert.equal((await f.handle(req({case_id:entry.id,model:'paid'}),f.env)).status,400);
  assert.equal((await f.handle(req({case_id:'unknown'}),f.env)).status,404);
  assert.equal((await f.handle(req(undefined,{origin:'https://other.invalid'}),f.env)).status,403);
  assert.equal((await f.handle(req({case_id:'x'.repeat(260)}),f.env)).status,413);assert.equal(f.calls,0);
});
test('missing inference stays blocked; provider errors expose no credential strings or fallback',async()=>{
  const unavailable=setup({missing:true});assert.equal((await unavailable.handle(req(),unavailable.env)).status,503);assert.equal(unavailable.calls,0);
  const failed=setup({throwing:true});const receipt=await (await failed.handle(req(),failed.env)).json();
  assert.equal(failed.calls,1);assert.equal(receipt.result,'BLOCKED');assert.ok(!JSON.stringify(receipt).includes('credential-must-not-leak'));
});
test('contextual assent failure stays visible instead of being redefined as a successful refusal',async()=>{
  const f=setup();const receipt=await (await f.handle(req({case_id:'20261014-C'}),f.env)).json();
  assert.equal(f.calls,0);assert.equal(receipt.actual.error.code,'prior_state_ambiguous_scope');assert.equal(receipt.result,'BLOCKED');
});
test('Worker routes test surface before D1 initialization while retaining existing auth and video routes',async()=>{
  const worker=await readFile(new URL('../src/control-worker.js',import.meta.url),'utf8');
  assert.match(worker,/authorize:isAdmin/);
  assert.ok(worker.indexOf('const testResponse=await conversationTest(request,env)')<worker.indexOf('await ensureSchema(env)',worker.indexOf('async function control(')));
  assert.match(worker,/path==='\/control\/video-test'/);assert.match(worker,/contextWorkstream:data.context_workstream/);
});
test('mobile test page parses, requires explicit Run and renders responses as text',()=>{
  new Script(page.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.match(page,/if\(running\|\|!available\)return/);assert.match(page,/textContent=data.actual/);assert.doesNotMatch(page,/innerHTML|localStorage|sessionStorage/);
  assert.match(page,/independent review/);
});
test('published source fingerprints match the actual candidate being tested',async()=>{
  const revision=JSON.parse(await readFile(new URL('../src/control/conversation-test-revision.json',import.meta.url),'utf8'));
  for(const [path,hash]of Object.entries(revision.source_sha256)){
    assert.equal(createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex'),hash,path);
  }
});
