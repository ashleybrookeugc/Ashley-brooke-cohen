// Public-media qualification fixtures only; this does not replace the analyzer.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SOURCE_SHA256='543a4ad9fef4c9e0004ec9482cb7225c2574b0f889291e8270b1c4d61dbc1ab8';
export const SPEECH='I do not think this is fair because you know the answer. Why not? Because I already checked it.';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=async path=>digest(await readFile(path));
function run(args,cwd){return new Promise((ok,no)=>{
  const child=spawn('ffmpeg',args,{cwd,stdio:['ignore','pipe','pipe']});let out='',err='';
  const timer=setTimeout(()=>child.kill(),60000);
  child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);
  child.on('error',e=>{clearTimeout(timer);no(e)});
  child.on('close',code=>{clearTimeout(timer);code===0?ok({out,err}):no(Error('FFmpeg qualification failed: '+err.slice(-1000)))});
});}
export async function buildFixtures(sourcePath,outputDir){
  sourcePath=resolve(sourcePath);outputDir=resolve(outputDir);
  // Reject truncated/replaced downloads before decoding or transmitting anything.
  if(await sha(sourcePath)!==SOURCE_SHA256)throw Error('SOURCE_HASH_MISMATCH');
  await run(['-v','error','-xerror','-i',sourcePath,'-f','null','-']);
  await mkdir(outputDir,{recursive:true});
  const speechPath=join(outputDir,'speech.txt');await writeFile(speechPath,SPEECH+'\n');
  const voiced=join(outputDir,'av-negation.mp4'),silent=join(outputDir,'av-silent.mp4');
  await run(['-v','error','-ss','38','-i',sourcePath,'-f','lavfi','-i','flite=textfile=speech.txt:voice=slt','-map','0:v:0','-map','1:a:0','-t','15','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-af','apad','-map_metadata','-1','-y',voiced],outputDir);
  await run(['-v','error','-i',voiced,'-c:v','copy','-af','volume=0','-c:a','aac','-map_metadata','-1','-y',silent]);
  const frames=await run(['-v','error','-xerror','-i',voiced,'-map','0:v:0','-f','framemd5','-']);
  const twin=await run(['-v','error','-xerror','-i',silent,'-map','0:v:0','-f','framemd5','-']);
  if(frames.out!==twin.out)throw Error('VISUAL_CONTROL_MISMATCH');
  const volume=await run(['-hide_banner','-i',silent,'-vn','-af','volumedetect','-f','null','-']);
  // FFmpeg's PCM floor is -91 dB. Require its floor, not a subjective silence label.
  const peak=Number(volume.err.match(/max_volume: ([-\d.]+) dB/)?.[1]);
  if(!Number.isFinite(peak)||peak> -90)throw Error('SILENT_CONTROL_NOT_SILENT');
  const receipt={schema:'ashley.public-av-controls.v1',created_at:new Date().toISOString(),ffmpeg_version:(await run(['-version'])).out.split('\n')[0],
    source:{url:'https://github.com/mediaelement/mediaelement-files/raw/master/big_buck_bunny.mp4',sha256:SOURCE_SHA256,full_decode:'PASS'},
    derivation:{source_start_seconds:38,duration_seconds:15,speech:SPEECH,speech_kind:'synthetic FFmpeg/libflite slt; original audio replaced',source_time_rule:'source_seconds = clip_seconds + 38'},
    voiced:{file:'av-negation.mp4',sha256:await sha(voiced)},silent:{file:'av-silent.mp4',sha256:await sha(silent),peak_db:peak},
    decoded_video_frames_identical:true,frame_manifest_sha256:digest(frames.out),
    acceptance:{exact_speech:'NOT_RUN',silent_no_speech:'NOT_RUN',visible_action:'NOT_RUN',voice_attribution:'NOT_RUN',timestamps:'NOT_RUN',deployed_integration:'NOT_RUN'},
    limits:'Public animated footage plus controlled synthetic speech; not private creator/iPhone acceptance. A fixture build is not model success.'};
  await writeFile(join(outputDir,'fixture-receipt.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.length!==4)throw Error('Usage: node scripts/acceptance/video-service-fixtures.mjs SOURCE_MP4 OUTPUT_DIRECTORY');
  console.log(JSON.stringify(await buildFixtures(resolve(process.argv[2]),resolve(process.argv[3])),null,2));
}
