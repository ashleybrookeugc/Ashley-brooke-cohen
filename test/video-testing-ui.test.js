import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/video-test/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/video-test/index.html',import.meta.url),'utf8');
class Element{
 constructor(){this.children=[];this.value='';this.files=[];this.hidden=false;this.disabled=false;this.textContent='';}
 append(...children){this.children.push(...children)}replaceChildren(...children){this.children=children}addEventListener(){}removeAttribute(name){delete this[name]}load(){}focus(){}
}
const fixture={id:'fixture',job:{id:'fixture',name:'sample.mp4',state:'completed'},feedback:[],result:{manifest:{content_sha256:'hash',duration_seconds:1,coverage:{visual_sampling:{frame_count:1,interval_seconds:5,frames:[{source_timestamp_seconds:0}]}}},evidence:{sampling_disclosure:'Sampled, not exhaustive.',lanes:{spoken_audio:{state:'extractor_unavailable',observations:[]},visible_actions_subjects_ui_state:{state:'sampled',observations:[{observation_id:'visual-1',source_timestamp_seconds:0,uncertainty:'Meaning undetermined'}]}}}}};
function indexedDBDouble(saved){return {open(){const req={result:{transaction(){const tx={objectStore(){return {getAll(){const r={};queueMicrotask(()=>{r.result=[...saved.values()].map(x=>structuredClone(x));r.onsuccess()});return r},put(run){saved.set(run.id,structuredClone(run));queueMicrotask(()=>tx.oncomplete())}}}};return tx}}};queueMicrotask(()=>req.onsuccess());return req}}}
async function boot(saved,fetchImpl=async()=>new Response(JSON.stringify({error:'Worker offline'}),{status:503})){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document={getElementById:id=>{assert.ok(elements.has(id),'Missing element '+id);return elements.get(id)},createElement:()=>new Element()};
 const run=new (Object.getPrototypeOf(async function(){}).constructor)('document','indexedDB','fetch','Option',source);
 await run(document,indexedDBDouble(saved),fetchImpl,function(label,value){this.textContent=label;this.value=value});return elements;
}
test('actual UI module executes with DOM/storage doubles: offline review, correction, reload retrieval, safe text rendering',async()=>{
 const saved=new Map([['fixture',structuredClone(fixture)]]);let ui=await boot(saved);
 assert.match(ui.get('status').textContent,/offline/);assert.equal(ui.get('analyze').disabled,true);
 await ui.get('runs').children[0].onclick();assert.equal(ui.get('review').hidden,false);assert.match(ui.get('boundary').textContent,/not a creative verdict/);
 ui.get('text').value='<img src=x onerror=alert(1)> This observation is wrong.';ui.get('observation').value='visual-1';ui.get('time').value='0';
 await ui.get('correction').onsubmit({preventDefault(){}});assert.equal(saved.get('fixture').feedback.length,1);assert.equal(saved.get('fixture').feedback[0].synced,false);
 ui=await boot(saved);await ui.get('runs').children[0].onclick();assert.equal(ui.get('feedback').children.length,1);assert.match(ui.get('feedback').children[0].children[1].textContent,/<img/);
});

test('signed-in Mary Kate user selects a video and Analyze enables without token entry',async()=>{
 const calls=[];const ui=await boot(new Map(),async path=>{
  calls.push(path);return Response.json(path.endsWith('/session')?{configured:true,authenticated:true}:path.endsWith('/health')?{state:'available'}:{jobs:[]});
 });
 assert.equal(ui.get('access').hidden,true);assert.equal(ui.get('analyze').disabled,true);
 ui.get('file').files=[new Blob(['synthetic fixture'],{type:'video/mp4'})];
 await ui.get('file').onchange();assert.equal(ui.get('analyze').disabled,false);
 assert.deepEqual(calls,['/api/video-test/session','/api/video-test/health','/api/video-test/jobs']);
 assert.doesNotMatch(html,/id="token"|id="login"|Testing token|Trust this device/);
});
test('signed-out user sees normal Mary Kate login and cannot analyze a selected file',async()=>{
 const calls=[];const ui=await boot(new Map(),async path=>{calls.push(path);return Response.json({configured:true,authenticated:false})});
 assert.equal(ui.get('access').hidden,false);assert.match(ui.get('status').textContent,/Sign in to Mary Kate/);
 ui.get('file').files=[new Blob(['fixture'])];await ui.get('file').onchange();assert.equal(ui.get('analyze').disabled,true);
 assert.deepEqual(calls,['/api/video-test/session']);assert.match(html,/href="\/admin\/login\?returnTo=\/video-test\/"/);
});
