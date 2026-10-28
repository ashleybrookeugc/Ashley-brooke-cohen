import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectAudio,releaseClaims} from '../tools/video-testing/audio-evidence-gate.mjs';
const dir=process.env.AV_CONTROLS_DIR;
test('real footage: reject times past the clip, retain reviewed visuals without an audio track',{skip:!dir&&'Requires checksum-verified public controls'},async()=>{
 const f=JSON.parse(await readFile(join(dir,'fixture-receipt.json')));
 const audio=await inspectAudio(join(dir,f.voiced.file),f.voiced.sha256);
 const visual={source_sha256:f.voiced.sha256,modality:'visual',text:'The rabbit emerges from the burrow.',start:0,end:15,visual_evidence_verified:true};
 const pastEnd={...visual,start:15,end:16};
 // Reproduce the fresh MiniCPM response's 15–16s claim on the actual 15s source.
 assert.deepEqual(releaseClaims({source_sha256:f.voiced.sha256,audio,claims:[visual,pastEnd]}).released,[visual]);
 const speech={source_sha256:f.voiced.sha256,modality:'speech',text:f.derivation.speech,start:0,end:16};
 assert.equal(releaseClaims({source_sha256:f.voiced.sha256,audio,claims:[speech],verifiedAudio:[{...speech,independent:true}]}).released.length,0);
 assert.equal(releaseClaims({source_sha256:f.voiced.sha256,audio:{...audio,source_sha256:'wrong'},claims:[visual]}).released.length,0);
 const temp=await mkdtemp(join(tmpdir(),'av-no-track-'));
 try{
  const path=join(temp,'no-track.mp4');
  execFileSync('ffmpeg',['-v','error','-i',join(dir,f.silent.file),'-map','0:v:0','-c:v','copy','-an',path]);
  const hash=createHash('sha256').update(await readFile(path)).digest('hex');
  const noTrack=await inspectAudio(path,hash);
  assert.equal(noTrack.state,'no_audio_track');
  const v={...visual,source_sha256:hash},s={...speech,source_sha256:hash,end:9};
  assert.deepEqual(releaseClaims({source_sha256:hash,audio:noTrack,claims:[v,s],verifiedAudio:[{...s,independent:true}]}).released,[v]);
 }finally{await rm(temp,{recursive:true,force:true});}
});
