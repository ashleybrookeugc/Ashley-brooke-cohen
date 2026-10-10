const REPO='ashleybrookeugc/Ashley-brooke-cohen';

export const VIDEO_EVIDENCE_CATALOG=Object.freeze([
  {id:'F-003',purpose:'Keep sampled evidence tied to original source timestamps.',path:'docs/test-receipts/2026-10-09-video-analyzer-frozen-baseline.json',commit:'c13e80382c3ed846a379991beb421c9b4318897d',input_type:'deterministic fixture',source_identity:'F-003 timestamp-fidelity fixture',duration:'Not recorded separately in the canonical receipt'},
  {id:'F-004',purpose:'Detect meaningful localized visual activity that whole-frame averaging misses.',path:'docs/test-receipts/2026-10-09-video-analyzer-f004-regional-activity.json',commit:'b5c59787f2d843ced604786d19572cb0e1faaeeb',input_type:'deterministic fixture',source_identity:'64×64 regional-activity fixture',duration:'Four supplied frames; no encoded-video duration'},
  {id:'F-005',purpose:'Preserve selected visual activity even when OCR text does not change.',path:'docs/test-receipts/2026-10-09-video-analyzer-f005-event-selection.json',commit:'c94898f6302ea9ade17e3452d9a78a306d7138e9',input_type:'deterministic fixture',source_identity:'Four-frame unchanged-OCR selection fixture',duration:'Observed source times 3.25–4.25 seconds'},
  {id:'F-006',purpose:'Bind selected events and their actual frames to the ordinary semantic-analysis input.',path:'docs/test-receipts/2026-10-09-video-analyzer-f006-semantic-input.json',commit:'6141689d83a762d565715e5745d2b5cff7837266',input_type:'deterministic fixture',source_identity:'Decoded screen-state MP4 fixture',duration:'3 seconds'},
  {id:'P-001',purpose:'Measure current OCR cost and duplicate-frame opportunity before scheduling changes.',path:'docs/test-receipts/2026-10-09-video-analyzer-p001-selective-ocr-baseline.json',commit:'27e0f97a8e691056789db25ae7a8969e7b95dfff',input_type:'fixtures and authorized real video',source_identity:'Three deterministic controls plus authorized Walmart pop-up Muse V6',duration:'3 s, 5.186 s, 5.186 s, and 38.444 s'},
  {id:'P-002',purpose:'Compare baseline OCR with exact-frame memoization without changing the default analyzer.',path:'docs/test-receipts/2026-10-09-video-analyzer-p002-exact-frame-ocr-ab.json',commit:'e5dfe3e4d3967615f23eb064896de1303f86ded9',input_type:'fixtures and authorized real video',source_identity:'Three deterministic controls plus authorized Walmart pop-up Muse V6',duration:'3 s, 5.186 s, 5.186 s, and 38.444 s'},
]);

const ASSETS=Object.freeze({
  'f006-edit-frame':{path:'.fixture-assets/screen-edit.png',commit:'e5dfe3e4d3967615f23eb064896de1303f86ded9',content_type:'image/png'},
  'f006-watch-frame':{path:'.fixture-assets/screen-watch.png',commit:'e5dfe3e4d3967615f23eb064896de1303f86ded9',content_type:'image/png'},
});

const statusFor=(entry,receipt)=>{
  if(entry.id==='F-003') return receipt.tests?.find(test=>String(test.name).startsWith('F-003:'))?.status||'UNAVAILABLE';
  return String(receipt.status||'UNAVAILABLE').startsWith('PASS')?'PASS':String(receipt.status||'UNAVAILABLE').startsWith('FAIL')?'FAIL':receipt.status||'UNAVAILABLE';
};
const suite=(receipt)=>receipt.full_suite||receipt.regressions?.complete_suite||null;
const publicRuns=(receipt)=>{
  const runs=receipt.benchmark_runs||receipt.comparisons||[];
  return runs.map(run=>{
    const baseline=run.baseline||run;
    const candidate=run.candidate;
    return {
      source:run.fixture_id,
      input_type:String(run.media_class||'').includes('real')?'real video':'deterministic fixture',
      duration_seconds:baseline.input?.duration_seconds??null,
      sampled_frames:baseline.sampled_frame_count??null,
      selected_visual_events:baseline.selected_visual_event_count??null,
      ocr_observations:baseline.ocr_observation_count??baseline.ocr?.invocations?.reduce((n,x)=>n+(x.observation_count||0),0)??null,
      baseline_analyzer_ms:baseline.analyzer_wall_ms??null,
      candidate_analyzer_ms:candidate?.analyzer_wall_ms??null,
      baseline_ocr_calls:baseline.ocr?.tesseract_invocation_count??baseline.ocr?.frame_invocation_count??null,
      candidate_ocr_calls:candidate?.ocr?.tesseract_invocation_count??null,
      cache_hits:candidate?.ocr?.cache_hit_count??null,
      output_equivalent:run.comparison?.evidence_json_equal??null,
    };
  });
};

export function normalizeVideoEvidenceReceipt(entry,receipt,retrievedAt) {
  const full=suite(receipt);
  const selected=receipt.after_payload_evidence?.selected_events?.map((event,index)=>({
    observation_id:event.observation_id,
    timestamp_seconds:event.source_timestamp_seconds,
    selection_reasons:event.selection_reasons||[],
    ocr_references:event.ocr_observation_ids||[],
    uncertainty:'Semantic meaning not determined',
    preview_url:index<2?'/api/control/video-evidence/assets/'+(index===0?'f006-edit-frame':'f006-watch-frame'):null,
  }))||[];
  const measured=[];
  if(entry.id==='F-003') measured.push(`${receipt.aggregate?.passed||0}/${receipt.aggregate?.tests||0} baseline tests passed; F-003 itself passed.`, `Known ASR counterexample: expected “${receipt.counterexample?.expected}”; observed “${receipt.counterexample?.actual}”.`);
  if(receipt.focused_post_fix) measured.push(`Focused test: ${receipt.focused_post_fix.passed}/${receipt.focused_post_fix.tests} passed in ${receipt.focused_post_fix.duration_ms} ms.`);
  if(receipt.focused_tests) measured.push(...Object.values(receipt.focused_tests).filter(x=>x?.tests).map(x=>`${x.passed}/${x.tests} focused tests passed in ${x.duration_ms} ms.`));
  if(full) measured.push(`Complete suite: ${full.passed}/${full.tests} passed; ${full.failed} failed${full.wall_seconds!=null?`; ${full.wall_seconds} s wall time`:''}.`);
  if(receipt.decision?.basis) measured.push(...receipt.decision.basis);
  if(receipt.transient_text_ground_truth) measured.push(`Transient text “${receipt.transient_text_ground_truth.expected_text}” was detected at dense cadence and missed at the default five-second cadence.`);
  return {
    id:entry.id,purpose:entry.purpose,status:statusFor(entry,receipt),input_type:entry.input_type,
    source_identity:entry.source_identity,duration:entry.duration,
    inspected: entry.id==='F-006'?'Ordinary processVideo output, persisted semantic input, two selected events, extracted frame bytes, OCR references, coverage, and package read-back.':entry.id.startsWith('P-')?'OCR execution, timing, resource use, evidence equivalence, selected-event counts, deterministic controls, and one authorized real-video control.':'The bounded condition named by the test and its preserved regression controls.',
    acceptance: entry.id==='F-003'?'The F-003 test passes while the unchanged ASR wording failure remains visible.':entry.id==='P-002'?'All seven predeclared correctness and performance gates in the receipt are true.':receipt.predeclared_expectation||receipt.acceptance||receipt.frozen_fixture||'The focused regression and its preserved controls pass.',
    measured, benchmark_runs:publicRuns(receipt), selected_events:selected,
    ocr: selected.length?{state:'references_available',note:'Observation references are available; OCR text, boxes, and confidence are not recorded in this canonical receipt.'}:{state:'unavailable',note:'Timestamp-level OCR detail is not recorded in this canonical receipt.'},
    asr: entry.id==='F-003'?{state:'counterexample_available',expected:receipt.counterexample?.expected,observed:receipt.counterexample?.actual,uncertainty:receipt.counterexample?.safety_implication}:{state:'unavailable',note:'No timestamped ASR transcript is recorded in this receipt.'},
    playback:{state:'unavailable',note:'Source video is not stored in Project Truth. No playback URL is available from this receipt.'},
    proves:receipt.conclusion||'The bounded test passed its recorded acceptance condition.',
    does_not_prove:receipt.evidence_boundary?.claim||'This component receipt does not prove arbitrary-video understanding, creative quality, creator acceptance, or production readiness.',
    human_creative_review:{occurred:false,label:'No creator acceptance recorded'},
    receipt:{repository:REPO,path:entry.path,commit:entry.commit,observed_at:receipt.observed_at||null,retrieved_at:retrievedAt},
  };
}

export function createVideoEvidenceService({github,now=()=>new Date().toISOString()}) {
  return {
    async list(){
      const retrievedAt=now();
      const settled=await Promise.allSettled(VIDEO_EVIDENCE_CATALOG.map(async entry=>{
        const file=await github.readFile(REPO,entry.path,entry.commit);
        return normalizeVideoEvidenceReceipt(entry,JSON.parse(file.content),retrievedAt);
      }));
      return {version:'video-evidence-v0',read_only:true,retrieved_at:retrievedAt,runs:settled.map((result,index)=>result.status==='fulfilled'?result.value:{...VIDEO_EVIDENCE_CATALOG[index],status:'UNAVAILABLE',error:'Canonical receipt could not be retrieved.',receipt:{repository:REPO,path:VIDEO_EVIDENCE_CATALOG[index].path,commit:VIDEO_EVIDENCE_CATALOG[index].commit,retrieved_at:retrievedAt}})};
    },
    async asset(id){
      const asset=ASSETS[id];
      if(!asset) return null;
      const file=await github.readFileBytes(REPO,asset.path,asset.commit);
      return {bytes:file.bytes,content_type:asset.content_type};
    },
  };
}
