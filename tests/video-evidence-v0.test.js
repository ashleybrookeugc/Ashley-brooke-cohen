import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGitHubAdapter} from '../src/control/adapters.js';
import {createVideoEvidenceService,normalizeVideoEvidenceReceipt,VIDEO_EVIDENCE_CATALOG} from '../src/control/video-evidence.js';

const receipt={
  observed_at:'2026-10-09T22:17:49Z',status:'PASS_BOUNDED_INPUT_CONTRACT',
  conclusion:'F-006 passes only for the bounded ordinary semantic-input contract.',
  after_payload_evidence:{selected_events:[
    {observation_id:'visual-000001',source_timestamp_seconds:0,selection_reasons:['initial_sampled_state'],ocr_observation_ids:['ocr-000001']},
    {observation_id:'visual-000004',source_timestamp_seconds:1.5,selection_reasons:['sampled_ocr_change'],ocr_observation_ids:['ocr-000004']},
  ]},
  full_suite:{tests:17,passed:16,failed:1,wall_seconds:9.58},
  evidence_boundary:{claim:'This does not prove model interpretation quality or a later claim-release gate.'},
};

test('normalizer exposes bounded F-006 evidence without source hashes or creative approval',()=>{
  const entry=VIDEO_EVIDENCE_CATALOG.find(x=>x.id==='F-006');
  const out=normalizeVideoEvidenceReceipt(entry,receipt,'2026-10-09T23:00:00Z');
  assert.equal(out.status,'PASS');
  assert.equal(out.selected_events.length,2);
  assert.equal(out.selected_events[1].timestamp_seconds,1.5);
  assert.equal(out.human_creative_review.occurred,false);
  assert.match(out.does_not_prove,/does not prove model interpretation quality/);
  assert.doesNotMatch(JSON.stringify(out),/sha256/i);
});

test('receipt service reads only allowlisted paths pinned to canonical commits and distinguishes real media',async()=>{
  const calls=[];
  const generic={...receipt,benchmark_runs:[]};
  const github={async readFile(repo,path,ref){calls.push({repo,path,ref});const entry=VIDEO_EVIDENCE_CATALOG.find(x=>x.path===path);if(entry.id==='P-001')return{content:JSON.stringify({...generic,status:'PASS_BASELINE_ESTABLISHED',benchmark_runs:[{fixture_id:'authorized-control',media_class:'authorized_representative_real_media',input:{duration_seconds:38.443677},sampled_frame_count:8,selected_visual_event_count:8,analyzer_wall_ms:11999.177,ocr:{tesseract_invocation_count:8}}]})};return{content:JSON.stringify(generic)}}};
  const out=await createVideoEvidenceService({github,now:()=> '2026-10-09T23:00:00Z'}).list();
  assert.equal(out.runs.length,6);
  assert.equal(calls.every((call,index)=>call.path===VIDEO_EVIDENCE_CATALOG[index].path&&call.ref===VIDEO_EVIDENCE_CATALOG[index].commit),true);
  assert.equal(out.runs.find(x=>x.id==='P-001').benchmark_runs[0].input_type,'real video');
});

test('GitHub binary reads retain server-side authorization and use a fixed ref',async()=>{
  const calls=[];
  const github=createGitHubAdapter({tokenProvider:async scope=>'secret-'+scope,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({sha:'blob',content:btoa('PNG')}),{status:200})}});
  const file=await github.readFileBytes('ashleybrookeugc/Ashley-brooke-cohen','.fixture-assets/screen-edit.png','fixed-commit');
  assert.equal(new TextDecoder().decode(file.bytes),'PNG');
  assert.match(calls[0].url,/ref=fixed-commit/);
  assert.equal(calls[0].options.headers.authorization,'Bearer secret-read');
  await assert.rejects(()=>github.readFileBytes('someone/else','secret','main'),/not readable/);
});

test('control page labels technical evidence, unavailable media, and creator review honestly',async()=>{
  const html=await readFile(new URL('../public/control/index.html',import.meta.url),'utf8');
  assert.match(html,/A passing component test is not creative approval/);
  assert.match(html,/Source playback/); 
  assert.match(html,/Human creative review/);
  assert.match(html,/api\/control\/video-evidence/);
});

test('control worker checks the existing admin session before either evidence route',async()=>{
  const source=await readFile(new URL('../src/control-worker.js',import.meta.url),'utf8');
  const guard=source.indexOf('if(!await isAdmin(request,env))   ');
  assert.ok(guard>=0);
  assert.ok(source.indexOf("path==='/api/control/video-evidence'",guard)>guard);
  assert.ok(source.indexOf('const assetMatch=',guard)>guard);
});
