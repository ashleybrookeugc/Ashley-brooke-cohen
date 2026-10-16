import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {validateUsefulReview,readUsefulReview,REPORT_VERSION,SPEECH_MODEL} from '../tools/video-testing/useful-review.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'content-review-'));await mkdir(join(dir,'review-audio'));await mkdir(join(dir,'frames'));await writeFile(join(dir,'source.bin'),'source');await writeFile(join(dir,'frames/0.jpg'),'frame');
 const relative='review-audio/00000000-0000-0000-0000-000000000001.wav';await writeFile(join(dir,relative),'audio');
 const frame={frame_id:'frame-1',source_timestamp_seconds:0,sha256:hash('frame'),relative_path:'frames/0.jpg'};
 const result={readback:{verified:true},package_directory:dir,manifest:{content_sha256:hash('source'),duration_seconds:5,coverage:{visual_sampling:{frames:[frame]}}}};
 const pictures={notes:[{observation_id:'visual-1',source_timestamp_seconds:0,description:'A monitor shows a green export button.',change:''}]};
 const summary={text:'The video shows an export screen.',refs:['visual-1'],time:0,checked:true};
 const report={version:REPORT_VERSION,source_sha256:hash('source'),state:'available',speech_model:SPEECH_MODEL,audio:{relative_path:relative,sha256:hash('audio'),sample_rate:16000,source_offset_seconds:0},transcript:{state:'available',segments:[{id:'speech-0',time:1,end:3,text:'Click Export.',checked:true}]},screen_text:[{id:'screen-frame-1-0',time:0,text:'OK',checked:true,frame_ref:{frame_id:'frame-1',source_timestamp_seconds:0,sha256:hash('frame')}}],summary:[summary],moments:[],audit:{checks:[{kind:'summary',claim:structuredClone(summary),check:{supported:true}}]}};
 async function save(){await writeFile(join(dir,'content-review.json'),JSON.stringify({sha256:hash(JSON.stringify(report)),report}));}
 await save();return{dir,result,pictures,report,save};
}
test('content report readback binds source, audio derivative and screen images; private audit and paths never leave the worker',async()=>{
 const f=await fixture();let report=await readUsefulReview(f.dir,f.result,f.pictures);assert.equal(report.state,'available');assert.equal(report.audio,undefined);assert.equal(report.audit,undefined);assert.equal(report.screen_text[0].text,'OK');
 await writeFile(join(f.dir,f.report.audio.relative_path),'corrupt');assert.equal((await readUsefulReview(f.dir,f.result,f.pictures)).state,'failed');
 await writeFile(join(f.dir,f.report.audio.relative_path),'audio');await writeFile(join(f.dir,'source.bin'),'other source');assert.equal((await readUsefulReview(f.dir,f.result,f.pictures)).state,'failed');
 await writeFile(join(f.dir,'source.bin'),'source');await writeFile(join(f.dir,'frames/0.jpg'),'other frame');assert.equal((await readUsefulReview(f.dir,f.result,f.pictures)).state,'failed');
});
test('wrong source, future speech, incorrect image time, unknown citations and rejected or changed exact wording cannot release',async()=>{
 const f=await fixture();for(const mutate of [r=>r.source_sha256='other',r=>r.transcript.segments[0].end=6,r=>r.screen_text[0].time=1,r=>r.summary[0].refs=['unknown'],r=>r.audit.checks[0].check.supported=false,r=>r.summary[0].text='An unsupported action happened.',r=>r.speech_model={...r.speech_model,revision:'other'},r=>r.audio.relative_path='../outside.wav']){const bad=structuredClone(f.report);mutate(bad);assert.throws(()=>validateUsefulReview(f.result,bad,f.pictures));}
 f.report.summary[0].checked=false;await f.save();assert.equal((await readUsefulReview(f.dir,f.result,f.pictures)).state,'failed');
});
