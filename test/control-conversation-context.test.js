import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore,createD1Store} from '../src/control/service.js';
import {createWorkersAiRoutingAdapter} from '../src/control/adapters.js';

const content='## Current active workstreams\n### Video analyzer\n**Current stage:** Development\n## Session handoff rule\n';
const probe={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary:'Controlled wiring probe; not a conversational answer.'};

test('preceding turns reach the actual Workers AI request in order with original roles',async()=>{
  const store=createMemoryStore();
  const turns=[{role:'user',content:'Give me a cloud Work prompt.'},{role:'assistant',content:'Start the existing cloud-only repair in Work.'}];
  await store.addInteraction({raw_text:turns[0].content,route:{...probe,plain_summary:turns[1].content}});
  let request;
  const router=createWorkersAiRoutingAdapter({AI:{run:async(_model,value)=>{request=value;return {response:probe.plain_summary};}}});
  const service=createControlService({github:{readFile:async()=>({content,sha:'fixture'})},router,store});
  await service.capture('Which setting should I select?');
  const packet=JSON.parse(request.messages[1].content).context;
  assert.deepEqual(request.messages.slice(2,-1),turns);
  assert.equal(packet.intent,'read_only_advice');
  assert.equal(request.tools,undefined);
  assert.equal(request.messages.at(-1).content,'Which setting should I select?');
  assert.equal((await store.listQueues()).needs_ashley.length,0);
});

test('D1 private conversation preserves chronological pairs without exposing raw text in UI history',async()=>{
  const queries=[];
  const db={prepare:query=>{queries.push(query);return {bind:()=>({all:async()=>({results:[{raw_text:'Second user',plain_summary:'Second assistant'},{raw_text:'First user',plain_summary:'First assistant'}]})})};}};
  const turns=(await createD1Store(db).listRecentConversation()).turns;
  assert.deepEqual(turns,[{role:'user',content:'First user'},{role:'assistant',content:'First assistant'},{role:'user',content:'Second user'},{role:'assistant',content:'Second assistant'}]);
  assert.match(queries[0],/ORDER BY rowid DESC LIMIT/);
});

test('bounded context discloses dropped whole interactions and keeps corrections intact',async()=>{
  const store=createMemoryStore();
  for(let i=0;i<14;i++) await store.addInteraction({raw_text:'u'+i,route:{...probe,plain_summary:'a'+i}});
  const context=await store.listRecentConversation();
  assert.equal(context.truncated,true);assert.equal(context.turns.length,24);
  assert.equal(context.turns[0].content,'u2');assert.equal(context.turns.at(-1).content,'a13');
  assert.equal(context.permission_authority,false);
});

test('advice questions cannot queue an implementation proposal; mixed command keeps action gates',async()=>{
  const proposal={target_repo:'ashleybrookeugc/research-vault',target_path:'SIDE_IDEAS.md',operation:'append_side_idea',title:'Unasked expansion',body:'Build another system',scope:'test'};
  for(const input of ['Should this be in Cloudflare Preview?','Should we use staging instead?','Should I deploy this?']) {
    const store=createMemoryStore();let intent;
    const service=createControlService({github:{readFile:async()=>({content,sha:'fixture'})},store,router:{route:async(_text,packet)=>{intent=packet.intent;return {...probe,route_kind:'side_idea',proposal};}}});
    await assert.rejects(()=>service.capture(input),error=>error.code==='read_only_route_violation');
    assert.equal(intent,'read_only_advice');assert.equal((await store.listQueues()).ai_can_handle.length,0);
  }
  const store=createMemoryStore();let intent;
  const service=createControlService({github:{readFile:async()=>({content,sha:'fixture'})},store,router:{route:async(_text,packet)=>{intent=packet.intent;return probe;}}});
  await service.capture('Should this be in Preview? Run the Video analyzer now.');
  assert.equal(intent,undefined);
});


test('generic questions, elliptical options and corrections are inert; explicit commands retain action gates',async()=>{
  const observed=[];
  const store=createMemoryStore();
  await store.addInteraction({raw_text:'We discussed a tool setting.',route:{...probe,plain_summary:'Several options are available.'}});
  const service=createControlService({github:{readFile:async()=>({content,sha:'fixture'})},store,router:{route:async(text,packet)=>{observed.push({text,intent:packet.intent});return probe;}}});
  for(const text of ['Which setting would you recommend?','And the other options','Or a different effort level','No, I am asking which option to select']) {
    await service.capture(text);assert.equal(observed.at(-1).intent,'read_only_advice');
  }
  for(const text of ['And update Video analyzer stage','What setting? Run Video analyzer now.','No, change Video analyzer stage']) {
    await service.capture(text);assert.equal(observed.at(-1).intent,undefined);
  }
});
