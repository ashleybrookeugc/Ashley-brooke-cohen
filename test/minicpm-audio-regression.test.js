import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectAudio,releaseClaims} from '../tools/video-testing/audio-evidence-gate.mjs';
const dir=process.env.AV_CONTROLS_DIR;
test('real MiniCPM voiced/silent replay: independent audio gate preserves speech/actions, suppresses invented sound',{skip:!dir&&'Set AV_CONTROLS_DIR to checksum-verified public fixture-builder output'},async()=>{
  const fixture=JSON.parse(await readFile(join(dir,'fixture-receipt.json')));
  const prior=JSON.parse(await readFile(new URL('../docs/test-receipts/2026-10-27-video-service-qualification.json',import.meta.url)));
  const results={};
  for(const kind of ['voiced','silent']){
    const source_sha256=fixture[kind].sha256;
    const audio=await inspectAudio(join(dir,fixture[kind].file),source_sha256);
    assert.equal(audio.state,kind==='silent'?'silence':'activity');
    const raw=prior.minicpm[kind].output;
    const visualText=kind==='voiced'?raw.split('\n\n')[1]:raw.split('\nNO SPEECH')[0];
    // Preserve separately reviewed source-frame observation verbatim, not mixed prose.
    const visual={source_sha256,modality:'visual',text:visualText,start:0,end:15,visual_evidence_verified:true};
    const sound={source_sha256,modality:'sound',text:'subtle grunting sounds',start:0,end:15};
    const speech={source_sha256,modality:'speech',text:fixture.derivation.speech,start:0,end:9};
    const claims=[visual,sound,{source_sha256,modality:'mixed',text:raw,start:0,end:15}];
    const verifiedAudio=[];
    if(kind==='voiced'){
      assert.ok(raw.includes(fixture.derivation.speech));claims.push(speech);
      // Independent synthetic source text, not a second model agreeing with itself.
      verifiedAudio.push({...speech,independent:true});
    }else assert.match(raw,/grunting sounds/); // preserved pre-gate real failure
    const gated=releaseClaims({source_sha256,audio,claims,verifiedAudio});
    assert.ok(gated.released.includes(visual));
    assert.equal(gated.released.some(c=>c.modality==='speech'),kind==='voiced');
    assert.equal(gated.released.some(c=>c.modality==='sound'||c.modality==='mixed'),false);
    assert.equal(releaseClaims({source_sha256,audio:undefined,claims:[speech]}).released.length,0);
    assert.equal(releaseClaims({source_sha256:'wrong',audio,claims}).released.length,0);
    results[kind]={state:audio.state,released:gated.released.map(c=>c.modality),withheld:gated.withheld.map(c=>c.reason)};
  }
  console.log(JSON.stringify({bounded_real_media_replay:results,new_model_inference:false}));
});
