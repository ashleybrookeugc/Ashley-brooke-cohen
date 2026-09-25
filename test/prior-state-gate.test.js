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
