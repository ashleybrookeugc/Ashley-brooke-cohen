import test from 'node:test';
import assert from 'node:assert/strict';
import {controlErrorResponse,createControlService,createMemoryStore} from '../src/control/service.js';

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
  let conflict;
  await assert.rejects(()=>app.capture('What uniform applies?'),error=>{conflict=error;return error.code==='conflict';});
  assert.equal(called,false);
  const response=controlErrorResponse(conflict);
  assert.match(response.error,/conflicting saved information/i);
  assert.doesNotMatch(response.error,/next-bounded-action|prior-state/i);
  assert.equal(response.action.required,true);
  assert.deepEqual(response.action.choices,[
    {source:'Wardrobe',value:'NYPD police uniform'},
    {source:'Wardrobe',value:'security uniform'}
  ]);
  assert.equal(response.technical.kind,'prior_state_conflict');
  assert.equal(response.technical.prior_state.status,'blocked');
  assert.equal((await app.state()).queues.needs_ashley.length,0);
  assert.equal((await app.state()).history.length,0);
});

test('next-action conflict is translated for Ashley while retaining the structured internal field',async()=>{
  let conflict;
  const app=appFor(documentWith(['Next bounded action','Review cut A'],['Next bounded action','Review cut B']),{route:async()=>route});
  await assert.rejects(()=>app.capture('Set the next bounded action.'),error=>{conflict=error;return error.code==='conflict';});
  const response=controlErrorResponse(conflict);
  assert.equal(response.error,"I found conflicting saved information about what the next action should be, so I didn't change anything.");
  assert.match(response.action.prompt,/Choose which saved next action is current/i);
  assert.equal(response.technical.prior_state.blockers[0].key,'next-bounded-action');
  assert.deepEqual(response.action.choices,[
    {source:'Wardrobe',value:'Review cut A'},
    {source:'Wardrobe',value:'Review cut B'}
  ]);
  assert.equal((await app.state()).queues.needs_ashley.length,0);
});

test('missing required fact fails closed instead of being guessed',async()=>{
  let called=false;
  const app=appFor(documentWith(['Dress code','Business casual']),{route:async()=>{called=true;return route;}});
  await assert.rejects(()=>app.capture('What should I wear?',{requiredFactKeys:['uniform']}),error=>error.code==='missing');
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

test('A: different projects have different next actions without contradiction, including two Mary Kate headings',async()=>{
  let packet;
  const content=['# Active Work','','## Current execution priority','','### Mary Kate / Project Truth reconciliation','**Next bounded action:** Priorities A  ','','## Current active workstreams','','### Mary Kate / AI operating system — **ACTIVE NOW**','**Next bounded action:** Test the V1 slice  ','','### Ashley portfolio / performance identity','**Next bounded action:** Review media B  ','','## Session handoff rule',''].join('\n');
  const app=appFor(content,{route:async(_text,next)=>{packet=next;return route;}});
  await app.capture('For Mary Kate / AI operating system, set the next bounded action to: Verify the V1 GitHub write contract through one approved production vertical slice.');
  assert.equal(packet.prior_state.status,'passed');
  assert.equal(packet.prior_state.evidence[0].section,'Mary Kate / AI operating system — **ACTIVE NOW**');
  assert.equal(packet.prior_state.evidence[0].value,'Test the V1 slice');
});

test('named workstream missing a field cannot borrow it from another Mary Kate projection',async()=>{
  let called=false, missing;
  const content=['# Active Work','','## Current execution priority','','### Mary Kate / Project Truth reconciliation','**Next bounded action:** Old Temporal fixture  ','','## Current active workstreams','','### Mary Kate / AI operating system — **ACTIVE NOW**','**Next:** Stale Temporal fixture  ','','## Session handoff rule',''].join('\n');
  const app=appFor(content,{route:async()=>{called=true;return route;}});
  await assert.rejects(()=>app.capture('For Mary Kate / AI operating system, set the next bounded action to: Verify the V1 GitHub write contract through one approved production vertical slice.'),error=>{missing=error;return error.code==='missing';});
  assert.equal(missing.prior_state.blockers[0].section,'Mary Kate / AI operating system — **ACTIVE NOW**');
  assert.equal(called,false);
  assert.deepEqual((await app.state()).history,[]);
});

test('B: two current values in one named workstream stop before routing with clear choices',async()=>{
  let called=false, conflict;
  const content=['# Active Work','','## Current active workstreams','','### Mary Kate / AI operating system — **ACTIVE NOW**','**Next bounded action:** Test route A  ','**Next bounded action:** Test route B  ','','### Portfolio','**Next bounded action:** Review media  ','','## Session handoff rule',''].join('\n');
  const app=appFor(content,{route:async()=>{called=true;return route;}});
  await assert.rejects(()=>app.capture('For Mary Kate / AI operating system, set the next bounded action.'),error=>{conflict=error;return error.code==='conflict';});
  const response=controlErrorResponse(conflict);
  assert.match(response.error,/conflicting saved information about what the next action should be/i);
  assert.deepEqual(response.action.choices.map(x=>x.value),['Test route A','Test route B']);
  assert.equal(response.technical.prior_state.blockers[0].section,'Mary Kate / AI operating system — **ACTIVE NOW**');
  assert.equal(called,false);
  assert.deepEqual((await app.state()).queues,{needs_ashley:[],ai_can_handle:[]});
  assert.deepEqual((await app.state()).history,[]);
});

test('C: insufficient workstream scope is ambiguity, not contradictory truth',async()=>{
  let called=false, ambiguity;
  const content=['# Active Work','','## Current active workstreams','','### Mary Kate','**Next bounded action:** Test gates  ','','### Portfolio','**Next bounded action:** Review media  ','','## Session handoff rule',''].join('\n');
  const app=appFor(content,{route:async()=>{called=true;return route;}});
  await assert.rejects(()=>app.capture('What is the next bounded action?'),error=>{ambiguity=error;return error.code==='ambiguous_scope';});
  const response=controlErrorResponse(ambiguity);
  assert.equal(response.error,"I can't safely tell which workstream you mean, so I didn't change anything.");
  assert.deepEqual(response.action.choices.map(x=>x.source),['Mary Kate','Portfolio']);
  assert.equal(response.technical.prior_state.blockers[0].reason,'ambiguous_scope');
  assert.equal(called,false);
  assert.deepEqual((await app.state()).history,[]);
});
