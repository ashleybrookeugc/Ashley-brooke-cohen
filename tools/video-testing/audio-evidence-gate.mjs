import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
function command(name,args,limit=64*1024*1024){return new Promise((ok,no)=>{
  const p=spawn(name,args,{stdio:['ignore','pipe','pipe']});let chunks=[],size=0,error='';
  const timer=setTimeout(()=>p.kill(),60000);
  p.stdout.on('data',b=>{size+=b.length;if(size>limit)p.kill();else chunks.push(b)});
  p.stderr.on('data',b=>{error=(error+b).slice(-1000)});
  p.on('error',e=>{clearTimeout(timer);no(e)});
  p.on('close',code=>{clearTimeout(timer);code===0&&size<=limit?ok(Buffer.concat(chunks)):no(Error('Audio evidence unavailable: '+error))});
});}
// Energy detects activity, never the semantic identity or cause of a sound.
// Conservative thresholds leave quiet signals uncertain rather than calling them silence.
export async function inspectAudio(path,expectedSha){
  if(sha(await readFile(path))!==expectedSha)throw Error('SOURCE_HASH_MISMATCH');
  const probe=JSON.parse(await command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path]));
  const track=probe.streams.find(x=>x.codec_type==='audio');
  if(!track)return{source_sha256:expectedSha,state:'no_audio_track',windows:[]};
  const offset=Number(track.start_time||0)-Number(probe.format.start_time||0);
  if(!Number.isFinite(offset))throw Error('Audio time unavailable');
  const pcm=await command('ffmpeg',['-v','error','-xerror','-i',path,'-map','0:a:0','-vn','-ac','1','-ar','16000','-f','f32le','-']);
  if(!pcm.length||pcm.length%4)throw Error('Audio decode incomplete');
  if(sha(await readFile(path))!==expectedSha)throw Error('SOURCE_HASH_MISMATCH');
  const windows=[];
  for(let pos=0;pos<pcm.length;pos+=16000*4/10){
    let peak=0,sum=0,n=0;
    for(let i=pos;i<Math.min(pos+6400,pcm.length);i+=4){const v=pcm.readFloatLE(i);if(!Number.isFinite(v))throw Error('Invalid audio sample');peak=Math.max(peak,Math.abs(v));sum+=v*v;n++;}
    const peakDb=peak?20*Math.log10(peak):-Infinity,rmsDb=sum?10*Math.log10(sum/n):-Infinity;
    windows.push({start:offset+pos/64000,end:offset+(pos+n*4)/64000,state:peakDb<=-90?'silence':rmsDb>=-50&&peakDb>=-40?'activity':'uncertain',peak_db:Math.max(-160,peakDb),rms_db:Math.max(-160,rmsDb)});
  }
  return{source_sha256:expectedSha,state:windows.every(w=>w.state==='silence')?'silence':windows.some(w=>w.state==='activity')?'activity':'uncertain',windows,method:'FFmpeg mono16k PCM;100ms windows; energy only, not sound recognition'};
}
// This is a trusted-host boundary: verification flags/verifiedAudio must come from
// source review or independent evidence, NEVER from provider-returned JSON.
// Only typed, separately grounded claims are renderable. Raw/mixed model prose is
// deliberately excluded; a sound's existence never verifies "grunting" or its cause.
export function releaseClaims({source_sha256,audio,claims,verifiedAudio=[]}){
  const released=[],withheld=[];
  for(const c of claims){
    let reason='unsupported claim';
    if(c.source_sha256!==source_sha256||typeof c.text!=='string'||!c.text.trim()||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<c.start)reason='invalid source or range';
    else if(c.modality==='visual'&&c.visual_evidence_verified===true){released.push(c);continue;}
    else if(['speech','sound'].includes(c.modality)){
      const windows=audio?.source_sha256===source_sha256?audio.windows?.filter(w=>w.end>c.start&&w.start<c.end):[];
      const active=windows?.some(w=>w.state==='activity');
      const supported=verifiedAudio.some(v=>v.source_sha256===source_sha256&&v.modality===c.modality&&v.text===c.text&&v.start===c.start&&v.end===c.end&&v.independent===true);
      if(active&&supported){released.push(c);continue;}
      reason=active?'sound identity/wording lacks independent support':'no independently detected audio activity in claim interval';
    }
    withheld.push({claim:c,reason});
  }
  return{released,withheld};
}
