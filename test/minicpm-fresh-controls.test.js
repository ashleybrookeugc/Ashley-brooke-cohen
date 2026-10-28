import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectAudio,releaseClaims} from '../tools/video-testing/audio-evidence-gate.mjs';
const dir=process.env.AV_CONTROLS_DIR;
test('fresh MiniCPM inference: mixed sound hallucination withheld, exact speech and independently admitted visual clauses retained',{skip:!dir&&'Requires original checksum-verified public controls'},async()=>{
 const receipt=JSON.parse(await readFile(new URL('../docs/test-receipts/2026-10-28-minicpm-fresh-controls.json',import.meta.url)));
 const fixture=JSON.parse(await readFile(join(dir,'fixture-receipt.json')));
 assert.equal(receipt.new_inference,true);
 for(const [kind,c] of Object.entries(receipt.cases)){
  const source_sha256=c.sha256,audio=await inspectAudio(join(dir,c.file),source_sha256);
  assert.equal(audio.state,kind==='voiced'?'activity':'silence');
  assert.ok(c.raw.includes(c.visual_clause));
  const visual={source_sha256,modality:'visual',text:c.visual_clause,start:0,end:15,visual_evidence_verified:true};
  const speech={source_sha256,modality:'speech',text:fixture.derivation.speech,start:0,end:9};
  const mixed={source_sha256,modality:'mixed',text:c.raw,start:0,end:15};
  const sound={source_sha256,modality:'sound',text:'a loud yawn or groan; a deep, resonant sound',start:0,end:15};
  const claims=[visual,mixed,sound],verifiedAudio=[];
  if(kind==='voiced'){assert.ok(c.raw.includes(speech.text));claims.push(speech);verifiedAudio.push({...speech,independent:true});}
  else{assert.match(c.raw,/loud yawn or groan/);assert.match(c.raw,/deep, resonant sound/);}
  const result=releaseClaims({source_sha256,audio,claims,verifiedAudio});
  assert.deepEqual(result.released,kind==='voiced'?[visual,speech]:[visual]);
  assert.ok(result.withheld.some(x=>x.claim===mixed));
  assert.ok(result.withheld.some(x=>x.claim===sound));
  assert.doesNotMatch(result.released.map(x=>x.text).join('\n'),/loud yawn|groan|resonant sound/);
  console.log(JSON.stringify({fresh_case:kind,audio:audio.state,released:result.released,withheld:result.withheld.map(x=>x.reason)}));
 }
});
