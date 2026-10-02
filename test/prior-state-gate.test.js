import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore} from '../src/control/service.js';

const route={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Saved with canonical context.'};
const documentWith = (...facts) => ['# Active Work','','## Current active workstreams','','### Wardrobe',...facts.map(([label,value])=>'**'+label+':** '+value+'  '),'','## Session handoff rule',''].join('\n');
const appFor = (content, router) => createControlService({github:{readFile:async()=>({content,sha:'canonical-sha'})},router,store:createMemoryStore()});

test('exact canonical fact survives retrieval without semantic generalization',async()=>{
  let packet;
  const app=appFor(documentWith(['Uniform','NYPD police uniform']),{route:async(_text,next)=>{packet=next;return route;}});
  await app.capture('What uniform applies?');
  assert.equal(packet.prior_state.status,'passed');
  assert.equal(packet.prior_state.evidence[0].value,'NYPD police uniform');
  assert.deepEqual(packet.prior_state.evidence[0].source,{repo:'ashleybrookeugc/research-vault',path:'ACTIVE_WORK.md',sha:'canonical-sha'});
});

test('conflicting canonical facts are surfaced before a worker is called',async()=>{
  let called=false;
  const app=appFor(documentWith(['Uniform','NYPD police uniform'],['Uniform','security uniform']),{route:async()=>{called=true;return route;}});
  await assert.rejects(()=>app.capture('What uniform applies?'),/Prior-state conflict for uniform/);
  assert.equal(called,false);
});

test('missing required fact fails closed instead of being guessed',async()=>{
  let called=false;
  const app=appFor(documentWith(['Dress code','Business casual']),{route:async()=>{called=true;return route;}});
  await assert.rejects(()=>app.capture('What should I wear?',{requiredFactKeys:['uniform']}),/Prior-state fact missing/);
  assert.equal(called,false);
});

test('worker cannot self-certify a passed prior-state gate without service evidence',async()=>{
  const app=appFor(documentWith(['Uniform','NYPD police uniform']),{route:async()=>({...route,prior_state:{gate:'prior-state.context-retrieval',status:'passed',evidence:[]}})});
  await assert.rejects(()=>app.capture('What uniform applies?'),/assigned by the control service/);
});


test('same field in different workstreams is scoped by the workstream named in the request',async()=>{
  let packet;
  const content=['# Active Work','','## Current execution priority','','### Mary Kate / Project Truth reconciliation','**Next bounded action:** Enforce the V1 write boundary  ','','## Current active workstreams','','### Ashley portfolio / performance identity','**Next bounded action:** Review performance media  ','','## Session handoff rule',''].join('\n');
  const app=appFor(content,{route:async(_text,next)=>{packet=next;return route;}});
  await app.capture('Continue Mary Kate next bounded action.');
  assert.equal(packet.prior_state.status,'passed');
  assert.equal(packet.prior_state.evidence[0].section,'Mary Kate / Project Truth reconciliation');
  assert.equal(packet.prior_state.evidence[0].value,'Enforce the V1 write boundary');
});

test('same field across unrelated workstreams is ambiguity, not a contradictory fact',async()=>{
  let called=false;
  const content=['# Active Work','','## Current active workstreams','','### Mary Kate','**Next bounded action:** Enforce gates  ','','### Portfolio','**Next bounded action:** Review media  ','','## Session handoff rule',''].join('\n');
  const app=appFor(content,{route:async()=>{called=true;return route;}});
  await assert.rejects(()=>app.capture('What is the next bounded action?'),error=>error.code==='ambiguous_scope'&&/more than one workstream/.test(error.message));
  assert.equal(called,false);
});
