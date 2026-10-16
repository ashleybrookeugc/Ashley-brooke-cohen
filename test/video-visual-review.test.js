import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {describeFrames,validateVisualReview,saveVisualReview,readVisualReview,MODEL} from '../tools/video-testing/visual-review.mjs';
import {buildReview} from '../public/video-test/review.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'visual-review-'));await mkdir(join(root,'frames'));
 const frames=[];for(let i=0;i<2;i++){const bytes=Buffer.from('verified-fixture-'+i);await writeFile(join(root,'frames',i+'.jpg'),bytes);frames.push({frame_id:'frame-'+i,source_timestamp_seconds:i*5,relative_path:'frames/'+i+'.jpg',sha256:hash(bytes)});}
 const events=frames.map((f,i)=>({observation_id:'visual-'+i,source_timestamp_seconds:f.source_timestamp_seconds,image_evidence:f}));
 const result={package_directory:root,readback:{verified:true},manifest:{content_sha256:'source-hash',duration_seconds:6,coverage:{visual_sampling:{frames}}},semantic_input:{source_media:{content_version_sha256:'source-hash'},selected_events:events},evidence:{lanes:{visible_actions_subjects_ui_state:{observations:events.map(e=>({...e,start_seconds:e.source_timestamp_seconds,state:'visual_state_change'}))}}}};
 return {root,result};
}
const supported=tasks=>tasks.map(t=>({observation_id:t.observation_id,description:'A blue bottle stands beside a monitor.',change:t.images.length===2?'A red mug in the earlier picture is replaced by a blue bottle.':'',check:{description_supported:true,change_supported:true,unsupported_details:[]}}));
test('released descriptions keep source/time/pair binding through restart; private candidates stay off browser API',async()=>{
 const {root,result}=await fixture();const review=await describeFrames(result,{inferImpl:async tasks=>supported(tasks)});
 assert.equal(review.notes.length,2);assert.equal(review.notes[1].frame_refs[0].source_timestamp_seconds,0);assert.equal(review.notes[1].source_timestamp_seconds,5);
 await saveVisualReview(root,review);const reread=await readVisualReview(root,result);assert.equal(reread.state,'available');assert.equal(reread.candidates,undefined);
 const report=buildReview({...result,visual_review:reread});assert.equal(report.timeline[1].title,'What is shown');assert.match(report.timeline[1].text,/Compared with the picture at 0:00:.*red mug/);
 for(const change of [r=>r.source_sha256='other',r=>r.notes[0].source_timestamp_seconds=2,r=>r.notes[1].frame_refs.reverse(),r=>r.notes[0].observation_id='unknown',r=>r.notes[0].release.description_supported=false]){const bad=structuredClone(review);change(bad);assert.throws(()=>validateVisualReview(result,bad));}
 const envelope=JSON.parse(await readFile(join(root,'visual-review.json'),'utf8'));envelope.review.notes[0].description='tampered';await writeFile(join(root,'visual-review.json'),JSON.stringify(envelope));assert.equal((await readVisualReview(root,result)).state,'failed');
});
test('unsupported, ambiguous or malformed model observations fail closed; no raw candidate becomes a readable claim',async()=>{
 const {result}=await fixture();for(const check of [{description_supported:false,change_supported:true,unsupported_details:[]},{description_supported:true,change_supported:true,unsupported_details:['wrong color']},{description_supported:'true',unsupported_details:[]},{description_supported:true}]){
  const review=await describeFrames(result,{inferImpl:async tasks=>supported(tasks).map(x=>({...x,check}))});assert.equal(review.state,'unreliable');assert.equal(review.notes.length,0);
 }
 const review=await describeFrames(result,{inferImpl:async tasks=>supported(tasks).map(x=>({...x,check:{...x.check,change_supported:false}}))});assert.equal(review.notes[1].change,'');
 const wrong={...review,source_sha256:'other'};assert.equal(buildReview({...result,visual_review:wrong}).timeline[0].title,'Picture or screen change');
 const subset={...review,notes:review.notes.slice(1)};const partial=buildReview({...result,visual_review:subset});assert.equal(partial.timeline.length,1);assert.equal(partial.byId.has('visual-0'),true);
 const separate=await describeFrames(result,{inferImpl:async tasks=>supported(tasks).map(x=>({...x,check:{description_supported:true,description_unsupported_details:[],change_supported:false,unsupported_details:['Comparison is uncertain']}}))});assert.equal(separate.notes.length,2);assert.equal(separate.notes[1].change,'');
});
test('corrupt, cross-file and escaped image artifacts are refused before any inference',async()=>{
 const {root,result}=await fixture();let calls=0;const options={inferImpl:async()=>{calls++;return []}};
 const bad=structuredClone(result);bad.semantic_input.selected_events[0].image_evidence.sha256='wrong';await assert.rejects(describeFrames(bad,options));assert.equal(calls,0);
 await writeFile(join(root,'frames','0.jpg'),'corrupt');await assert.rejects(describeFrames(result,options));assert.equal(calls,0);
 const external=join(root,'..','outside-'+Date.now()+'.jpg');await writeFile(external,'outside');await symlink(external,join(root,'frames','escaped.jpg'));result.manifest.coverage.visual_sampling.frames[0].relative_path='frames/escaped.jpg';result.manifest.coverage.visual_sampling.frames[0].sha256=hash('outside');result.semantic_input.selected_events[0].image_evidence=result.manifest.coverage.visual_sampling.frames[0];await assert.rejects(describeFrames(result,options));assert.equal(calls,0);
});
