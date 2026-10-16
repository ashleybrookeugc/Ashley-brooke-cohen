import {readFile,writeFile,rename,mkdir,realpath,stat} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const MODEL={id:'mlx-community/Qwen3-VL-8B-Instruct-4bit',revision:'defcdea7cc7a4b0858fea563cbbce171d328e457',license:'Apache-2.0',runtime:'mlx-vlm 0.7.8'};
export const RELEASE_VERSION='image-and-comparison-v2';
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=900;
export function visionConfig(env=process.env){return env.VIDEO_VISION_PYTHON&&env.VIDEO_VISION_MODEL?{python:resolve(env.VIDEO_VISION_PYTHON),model:resolve(env.VIDEO_VISION_MODEL)}:null;}
export async function visionReady(config=visionConfig()){
  if(!config)return false;
  try{await stat(config.python);const receipt=JSON.parse(await readFile(join(config.model,'mary-kate-model.json'),'utf8'));return receipt.id===MODEL.id&&receipt.revision===MODEL.revision&&receipt.verified===true;}catch{return false;}
}
function eventFrames(result,event){
  const frames=result.manifest.coverage.visual_sampling.frames;
  const index=frames.findIndex(f=>f.frame_id===event.image_evidence.frame_id);
  if(index<0||frames[index].source_timestamp_seconds!==event.source_timestamp_seconds||frames[index].sha256!==event.image_evidence.sha256)throw Error('Image binding mismatch');
  return index?[frames[index-1],frames[index]]:[frames[index]];
}
const refs=frames=>frames.map(f=>({frame_id:f.frame_id,source_timestamp_seconds:f.source_timestamp_seconds,sha256:f.sha256}));
function eligible(result){
  if(result.semantic_input?.source_media?.content_version_sha256!==result.manifest.content_sha256||result.readback?.verified!==true)throw Error('Unverified source');
  return result.semantic_input.selected_events;
}
async function checkedImage(result,frame){
  const root=await realpath(result.package_directory),path=await realpath(resolve(root,frame.relative_path));
  if(!path.startsWith(root+sep))throw Error('Image outside evidence package');
  const bytes=await readFile(path);if(bytes.length>8*1048576||hash(bytes)!==frame.sha256)throw Error('Image digest mismatch');return path;
}
async function infer(tasks,config){
  return new Promise((resolvePromise,reject)=>{
    const child=spawn(config.python,[fileURLToPath(new URL('./vision-infer.py',import.meta.url)),config.model],{env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',TRANSFORMERS_OFFLINE:'1'},stdio:['pipe','pipe','ignore']});
    let output='';const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Local vision timed out'));},15*60*1000);
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>150000){child.kill('SIGTERM');reject(Error('Vision output limit'));}});
    child.on('error',error=>{clearTimeout(timer);reject(error)});child.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw Error('Local vision failed');resolvePromise(JSON.parse(output));}catch(error){reject(error)}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({tasks}));
  });
}
export async function describeFrames(result,{config=visionConfig(),inferImpl=infer}={}){
  const events=eligible(result),limit=24;
  const selected=events.length<=limit?events:Array.from({length:limit},(_,i)=>events[Math.round(i*(events.length-1)/(limit-1))]);
  const tasks=[];for(const event of selected){const frames=eventFrames(result,event);tasks.push({observation_id:event.observation_id,images:await Promise.all(frames.map(f=>checkedImage(result,f)))});}
  const candidates=await inferImpl(tasks,config);if(!Array.isArray(candidates))throw Error('Invalid vision output');
  const notes=[];
  for(const event of selected){
    const candidate=candidates.find(x=>x.observation_id===event.observation_id),check=candidate?.check;
    const frames=eventFrames(result,event);for(const frame of frames)await checkedImage(result,frame);
    const descriptionDetails=check?.description_unsupported_details??check?.unsupported_details;
    if(!text(candidate?.description)||check?.description_supported!==true||!Array.isArray(descriptionDetails)||descriptionDetails.length)continue;
    const change=frames.length===2&&text(candidate.change)&&check.change_supported===true?candidate.change:'';
    notes.push({observation_id:event.observation_id,source_timestamp_seconds:event.source_timestamp_seconds,description:candidate.description,change,frame_refs:refs(frames),release:{decision:'supported',source_time_image_checks:true,description_supported:true,change_supported:change?true:null,method:'local_image_recheck_same_model_not_independent_human_verification'}});
  }
  return {schema:'local-picture-review.v1',release_version:RELEASE_VERSION,source_sha256:result.manifest.content_sha256,state:notes.length?'available':'unreliable',model:MODEL,created_at:new Date().toISOString(),coverage:{selected_total:events.length,inspected:selected.length,accepted:notes.length,sampled_not_exhaustive:true},notes,candidates};
}
export function validateVisualReview(result,review){
  if(review.schema!=='local-picture-review.v1'||review.source_sha256!==result.manifest.content_sha256||!['available','unreliable'].includes(review.state)||review.model?.id!==MODEL.id||review.model?.revision!==MODEL.revision||!Array.isArray(review.notes)||review.notes.length>24)throw Error('Visual review source/model mismatch');
  const events=eligible(result),seen=new Set();
  if(review.coverage?.selected_total!==events.length||review.coverage.accepted!==review.notes.length||!Number.isInteger(review.coverage.inspected)||review.coverage.inspected<review.notes.length||review.coverage.inspected>Math.min(24,events.length)||(review.state==='available')!==Boolean(review.notes.length))throw Error('Visual coverage mismatch');
  for(const note of review.notes){
    const event=events.find(e=>e.observation_id===note.observation_id);
    if(!event||seen.has(note.observation_id)||note.source_timestamp_seconds!==event.source_timestamp_seconds||!text(note.description)||typeof note.change!=='string'||note.change.length>900||JSON.stringify(note.frame_refs)!==JSON.stringify(refs(eventFrames(result,event)))||note.release?.decision!=='supported'||note.release.source_time_image_checks!==true||note.release.description_supported!==true||(note.change&&note.release.change_supported!==true))throw Error('Visual claim failed release checks');
    seen.add(note.observation_id);
  }
  return review;
}
export async function saveVisualReview(dir,review){
  const payload=JSON.stringify(review),envelope=JSON.stringify({sha256:hash(payload),review});
  await mkdir(join(dir,'visual-reviews'),{recursive:true,mode:0o700});await writeFile(join(dir,'visual-reviews',randomUUID()+'.json'),envelope,{mode:0o600,flag:'wx'});
  const temp=join(dir,'visual-review.'+randomUUID()+'.tmp');await writeFile(temp,envelope,{mode:0o600});await rename(temp,join(dir,'visual-review.json'));
}
export async function readVisualReview(dir,result){
  try{const {sha256,review}=JSON.parse(await readFile(join(dir,'visual-review.json'),'utf8'));if(hash(JSON.stringify(review))!==sha256)throw Error('Visual receipt digest mismatch');validateVisualReview(result,review);for(const note of review.notes){const event=eligible(result).find(e=>e.observation_id===note.observation_id);for(const frame of eventFrames(result,event))await checkedImage(result,frame);}const {candidates,...publicReview}=review;return publicReview;}
  catch(error){return {state:error.code==='ENOENT'?'not_run':'failed',notes:[]};}
}
