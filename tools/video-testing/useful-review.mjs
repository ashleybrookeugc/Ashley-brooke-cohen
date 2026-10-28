import {readFile,writeFile,mkdir,rename,realpath,stat} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectAudio} from './audio-evidence-gate.mjs';
import {visionConfig,visionReady} from './visual-review.mjs';
export const REPORT_VERSION='content-transcript-readable-text-v1';
export const SPEECH_MODEL={id:'mlx-community/whisper-large-v3-turbo-fp16',revision:'258e98b1f53da60a0a51c1e45e480ffa3ec71e23',license:'Apache-2.0',runtime:'mlx-audio 0.5.9'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const here=fileURLToPath(new URL('.',import.meta.url));
const validText=x=>typeof x==='string'&&x.trim().length>0&&x.length<=900;
const at=(time,result)=>Number.isFinite(time)&&time>=0&&time<=result.manifest.duration_seconds;
export function speechConfig(env=process.env){return env.VIDEO_SPEECH_MODEL?resolve(env.VIDEO_SPEECH_MODEL):null;}
export async function usefulReady(){try{const model=speechConfig(),receipt=JSON.parse(await readFile(join(model,'mary-kate-model.json'),'utf8'));return await visionReady()&&receipt.id===SPEECH_MODEL.id&&receipt.revision===SPEECH_MODEL.revision&&receipt.verified===true;}catch{return false;}}
function run(command,args,input,limit=3*1048576){return new Promise((ok,no)=>{const child=spawn(command,args,{env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',TRANSFORMERS_OFFLINE:'1'},stdio:['pipe','pipe','ignore']});let output='';const timer=setTimeout(()=>{child.kill();no(Error('Local review timed out'));},15*60*1000);child.on('error',e=>{clearTimeout(timer);no(e)});child.stdout.on('data',x=>{output+=x;if(output.length>limit){child.kill();no(Error('Local review output limit'))}});child.on('close',code=>{clearTimeout(timer);code===0?ok(output):no(Error('Local review component failed'))});child.stdin.on('error',()=>{});child.stdin.end(input?JSON.stringify(input):undefined)});}
async function checkedFile(root,relative,digest){const path=await realpath(resolve(root,relative));if(!path.startsWith(await realpath(root)+sep)||hash(await readFile(path))!==digest)throw Error('Review source digest mismatch');return path;}
function pictureEvidence(pictures){return pictures.notes.map(note=>({id:note.observation_id,time:note.source_timestamp_seconds,modality:'visible picture',text:note.description+(note.change?' Comparison with '+note.frame_refs[0].source_timestamp_seconds+' seconds: '+note.change:'')}));}
export function validateUsefulReview(result,report,pictures){
  if(result.readback?.verified!==true||report.version!==REPORT_VERSION||report.source_sha256!==result.manifest.content_sha256||report.speech_model?.id!==SPEECH_MODEL.id||report.speech_model?.revision!==SPEECH_MODEL.revision||!['available','unreliable'].includes(report.state))throw Error('Content report source mismatch');
  if(!Array.isArray(report.transcript?.segments)||report.transcript.segments.length>5000||!Array.isArray(report.screen_text)||report.screen_text.length>288)throw Error('Content report shape mismatch');
  const evidence=new Map(pictureEvidence(pictures).map(x=>[x.id,x])),seen=new Set(evidence.keys());
  for(const segment of report.transcript.segments){if(seen.has(segment.id)||!/^speech-\d+$/.test(segment.id)||!validText(segment.text)||!at(segment.time,result)||!at(segment.end,result)||segment.end<segment.time||segment.checked!==true)throw Error('Transcript binding mismatch');seen.add(segment.id);evidence.set(segment.id,{...segment,modality:'speech'});}
  if(report.transcript.segments.length&&(!report.audio||!/^[a-f0-9]{64}$/.test(report.audio.sha256)||!/^review-audio\/[a-f0-9-]{36}\.wav$/.test(report.audio.relative_path)||report.audio.sample_rate!==16000||!Number.isFinite(report.audio.source_offset_seconds)))throw Error('Audio binding mismatch');
  const frames=result.manifest.coverage.visual_sampling.frames;
  for(const item of report.screen_text){const frame=frames.find(f=>f.frame_id===item.frame_ref?.frame_id);if(seen.has(item.id)||!item.id.startsWith('screen-')||!validText(item.text)||!frame||item.time!==frame.source_timestamp_seconds||item.frame_ref.sha256!==frame.sha256||item.frame_ref.source_timestamp_seconds!==item.time||item.checked!==true)throw Error('Screen text binding mismatch');seen.add(item.id);evidence.set(item.id,{...item,modality:'screen text'});}
  for(const kind of ['summary','moments']){if(!Array.isArray(report[kind])||report[kind].length>6)throw Error('Report claims mismatch');for(const claim of report[kind]){const checked=report.audit?.checks?.some(x=>x.kind===kind&&x.claim.text===claim.text&&JSON.stringify(x.claim.refs)===JSON.stringify(claim.refs)&&x.check.supported===true);if(!validText(claim.text)||claim.checked!==true||!checked||!Array.isArray(claim.refs)||!claim.refs.length||claim.refs.some(ref=>!evidence.has(ref))||claim.time!==Math.min(...claim.refs.map(ref=>evidence.get(ref).time)))throw Error('Report citation mismatch');}}
  if((report.state==='available')!==Boolean(report.summary.length))throw Error('Report state mismatch');
  return report;
}
// Independent signal activity is a veto, never proof of a transcript's wording.
export function applyAudioActivityVeto(report,activity){
  if(activity.source_sha256!==report.source_sha256||!Number.isFinite(activity.duration_seconds))throw Error('Audio source mismatch');
  const copy=structuredClone(report),removed=new Set();
  copy.transcript.segments=copy.transcript.segments.filter(s=>{
    const valid=s.time>=0&&s.end>s.time&&s.end<=activity.duration_seconds&&activity.windows.some(w=>w.state==='activity'&&w.end>s.time&&w.start<s.end);
    if(!valid)removed.add(s.id);return valid;
  });
  for(const kind of ['summary','moments'])copy[kind]=copy[kind].filter(c=>!c.refs.some(ref=>removed.has(ref)));
  copy.transcript.withheld=(copy.transcript.withheld||0)+removed.size;
  copy.transcript.state=copy.transcript.segments.length?'available':activity.state==='no_audio_track'?'no_audio_track':'unreliable';
  copy.state=copy.summary.length?'available':'unreliable';
  return copy;
}
export async function createUsefulReview(dir,result,pictures){
  if(!await usefulReady())throw Error('Local content review unavailable');
  const source=await checkedFile(dir,'source.bin',result.manifest.content_sha256),config=visionConfig();
  const probe=JSON.parse(await run(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_streams','-show_format','-of','json',source]));
  const activity=await inspectAudio(source,result.manifest.content_sha256);
  const stream=probe.streams.find(s=>s.codec_type==='audio');let audio=null,segments=[],withheld=0,language=null;
  if(stream){
    const audioDir=join(dir,'review-audio');await mkdir(audioDir,{recursive:true,mode:0o700});
    const relative='review-audio/'+randomUUID()+'.wav',path=join(dir,relative);
    await run(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-nostdin','-i',source,'-map','0:a:0','-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',path]);
    const digest=hash(await readFile(path)),offset=Number(stream.start_time||0)-Number(probe.format.start_time||0);
    if(!Number.isFinite(offset))throw Error('Audio timing unavailable');
    audio={relative_path:relative,sha256:digest,sample_rate:16000,source_offset_seconds:offset};
    const output=JSON.parse(await run(config.python,[join(here,'speech-infer.py'),speechConfig()],{audio:path}));language=output.language;
    for(const [index,s] of (output.segments||[]).entries()){
      const time=s.start+offset,end=s.end+offset;
      if(!validText(s.text)||!at(time,result)||!at(end,result)||end<=time||end>activity.duration_seconds||!activity.windows.some(w=>w.state==='activity'&&w.end>time&&w.start<end)||!Number.isFinite(s.avg_logprob)||s.avg_logprob< -1||s.no_speech_prob>0.6||s.compression_ratio>2.4){withheld++;continue;}
      segments.push({id:'speech-'+index,time,end,text:s.text.trim(),checked:true,avg_logprob:s.avg_logprob,no_speech_prob:s.no_speech_prob});
    }
    await checkedFile(dir,relative,digest);await checkedFile(dir,'source.bin',result.manifest.content_sha256);
  }
  const all=result.manifest.coverage.visual_sampling.frames,limit=24;
  const selected=all.length<=limit?all:Array.from({length:limit},(_,i)=>all[Math.round(i*(all.length-1)/(limit-1))]);
  const frames=[];for(const frame of selected)frames.push({frame_id:frame.frame_id,time:frame.source_timestamp_seconds,image:await checkedFile(result.package_directory,frame.relative_path,frame.sha256),ref:{frame_id:frame.frame_id,source_timestamp_seconds:frame.source_timestamp_seconds,sha256:frame.sha256}});
  const output=JSON.parse(await run(config.python,[join(here,'report-infer.py'),config.model],{frames,evidence:[...pictureEvidence(pictures),...segments.map(s=>({id:s.id,time:s.time,text:s.text,modality:'speech or lyrics'}))]}));
  for(const frame of selected)await checkedFile(result.package_directory,frame.relative_path,frame.sha256);
  const report={version:REPORT_VERSION,source_sha256:result.manifest.content_sha256,state:output.summary?.length?'available':'unreliable',created_at:new Date().toISOString(),speech_model:SPEECH_MODEL,audio,transcript:{state:stream?(segments.length?'available':'unreliable'):'no_audio_track',language,withheld,segments},screen_text:output.screen_text.map(x=>({...x,checked:true})),summary:output.summary,moments:output.moments,audit:output.audit,coverage:{pictures_read:selected.length,total_pictures:all.length,sampled_not_exhaustive:true},verification:'Local model recheck and speech confidence checks; not independent human verification'};
  validateUsefulReview(result,report,pictures);
  const envelope=JSON.stringify({sha256:hash(JSON.stringify(report)),report});await mkdir(join(dir,'content-reviews'),{recursive:true,mode:0o700});await writeFile(join(dir,'content-reviews',randomUUID()+'.json'),envelope,{mode:0o600,flag:'wx'});const temp=join(dir,'content-review.'+randomUUID()+'.tmp');await writeFile(temp,envelope,{mode:0o600});await rename(temp,join(dir,'content-review.json'));return report;
}
export async function readUsefulReview(dir,result,pictures){try{const {sha256,report}=JSON.parse(await readFile(join(dir,'content-review.json'),'utf8'));if(hash(JSON.stringify(report))!==sha256)throw Error('Content receipt mismatch');validateUsefulReview(result,report,pictures);if(report.audio)await checkedFile(dir,report.audio.relative_path,report.audio.sha256);await checkedFile(dir,'source.bin',result.manifest.content_sha256);for(const item of report.screen_text){const frame=result.manifest.coverage.visual_sampling.frames.find(f=>f.frame_id===item.frame_ref.frame_id);await checkedFile(result.package_directory,frame.relative_path,frame.sha256);}const source=await checkedFile(dir,'source.bin',result.manifest.content_sha256);const gated=applyAudioActivityVeto(report,await inspectAudio(source,result.manifest.content_sha256));const {audio,audit,...publicReport}=gated;return publicReport;}catch(error){return{state:error.code==='ENOENT'?'not_run':'failed'};}}

