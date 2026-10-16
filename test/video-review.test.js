import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReview,describeObservation,timeLabel} from '../public/video-test/review.js';
const result={manifest:{duration_seconds:12,coverage:{visual_sampling:{interval_seconds:5,frames:[{source_timestamp_seconds:0},{source_timestamp_seconds:5},{source_timestamp_seconds:10}]}}},evidence:{lanes:{spoken_audio:{state:'completed',observations:[{observation_id:'speech-1',start_seconds:1,text:'is is there'}]},burned_in_captions:{state:'heuristically_classified',observations:[{observation_id:'caption-1',start_seconds:0,text:'this is fair'}]},visible_actions_subjects_ui_state:{state:'bounded_screen_state_classifier',observations:[{observation_id:'visual-1',start_seconds:5,state:'sampled_stable_state',activity:{state:'editing_workflow_candidate',matched_terms:['export']}}]}},modality_conflicts:[{type:'spoken_caption_disagreement',start_seconds:1}]}};
test('plain review preserves exact separate speech/caption wording, source times and unresolved conflicts',()=>{
 const r=buildReview(result);
 assert.deepEqual(r.timeline.map(x=>x.time),[0,1,5]);
 assert.equal(r.byId.get('speech-1').text,'“is is there”');assert.equal(r.byId.get('caption-1').text,'“this is fair”');
 assert.match(r.checks[0].text,/neither version has been confirmed/);assert.equal(r.checks[0].time,1);
 assert.match(r.coverage,/0:00, 0:05, 0:10/);
 assert.match(r.byId.get('speech-1').label,/Spoken words at 0:01/);assert.doesNotMatch(r.byId.get('speech-1').label,/speech-1/);
});
test('sampled picture stability and OCR hints never become claims about whole-video inactivity or workflow meaning',()=>{
 const r=buildReview(result);assert.match(r.byId.get('visual-1').text,/Something could still have happened/);
 assert.doesNotMatch(JSON.stringify(r.overview),/static|export|editing workflow/i);
 assert.match(r.limits.join(' '),/hook, pacing/);assert.match(r.limits.join(' '),/repeated work or errors/);
 assert.match(r.limits.join(' '),/stock suitability/);
});
test('missing evidence does not become silence, absent people or successful semantic understanding',()=>{
 const r=buildReview({});assert.match(r.overview.join(' '),/unavailable/);assert.match(r.coverage,/No checked pictures/);
 assert.match(describeObservation('visible_actions_subjects_ui_state',{}),/has not established/);
 assert.match(describeObservation('unexpected_new_lane',{state:'completed'}),/does not yet have a supported/);
 assert.equal(timeLabel(0.03),'0:00.03');assert.equal(timeLabel(3605),'1:00:05');assert.equal(timeLabel(NaN),'Time unavailable');
});
test('long videos retain bounded coverage text and preserve untrusted wording as data',()=>{
 const r=structuredClone(result);r.manifest.coverage.visual_sampling.frames=Array.from({length:720},(_,i)=>({source_timestamp_seconds:i*5}));
 r.evidence.lanes.spoken_audio.observations[0].text='<img src=x onerror=alert(1)>';
 const review=buildReview(r);assert.ok(review.coverage.length<220);assert.match(review.coverage,/720 pictures/);
 assert.equal(review.byId.get('speech-1').text,'“<img src=x onerror=alert(1)>”');
});
