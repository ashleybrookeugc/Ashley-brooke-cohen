// Render source-bound evidence and released local picture descriptions.
// No extra inference or creative verdict is generated in the browser.
export function timeLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Time unavailable';
  const ms = Math.round(seconds * 1000), whole = Math.floor(ms / 1000);
  const fraction = ms % 1000 ? '.' + String(ms % 1000).padStart(3, '0').replace(/0+$/, '') : '';
  const minutes = Math.floor(whole / 60);
  return (minutes >= 60 ? Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2, '0') : minutes)
    + ':' + String(whole % 60).padStart(2, '0') + fraction;
}
const names = {
  spoken_audio:'Spoken words', speaker_turns:'Speech passages',
  burned_in_captions:'Possible captions', other_on_screen_text:'Words on screen',
  visible_actions_subjects_ui_state:'Picture or screen change', visual_shot_state_changes:'Possible cut'
};
const observations = lane => lane?.observations || lane?.spans || lane?.raw_observations || [];
const when = item => item.source_timestamp_seconds ?? item.start_seconds ?? item.timestamp_seconds;
const unavailable = lane => !lane || /unavailable|failed|not_run|not_determined/.test(lane.state || '');
export function describeObservation(name, item) {
  if (['spoken_audio','burned_in_captions','other_on_screen_text'].includes(name)) {
    return typeof item.text === 'string' && item.text.trim() ? '“' + item.text.trim() + '”' : 'No readable wording was recovered for this moment.';
  }
  if (name === 'speaker_turns') return 'A speech passage was detected. Who is speaking has not been identified.';
  if (name === 'visible_actions_subjects_ui_state') {
    if (item.state === 'initial_state') return 'This is the first picture checked in the video.';
    if (item.state === 'sampled_stable_state') return 'No visual change was detected between this picture and the previous one checked. Something could still have happened between them.';
    if (['regional_visual_state_change','visual_state_change','major_visual_state_change'].includes(item.state)) return 'The picture changed compared with the previous one checked. What happened, and why, still needs review.';
    return 'A picture was checked here. The analyzer has not established which people, objects or actions it shows.';
  }
  if (name === 'visual_shot_state_changes') return 'A possible visual transition was flagged here. Watch it to check whether it is a cut or another kind of change.';
  return 'This saved observation needs human review. It does not yet have a supported plain-English interpretation.';
}
export function observationLabel(name, item) {
  const title = names[name] || 'Video note', at = when(item);
  const excerpt = typeof item.text === 'string' ? ' — ' + item.text.trim().slice(0, 65) : '';
  return title + (Number.isFinite(at) ? ' at ' + timeLabel(at) : '') + excerpt;
}
export function buildReview(result) {
  const manifest = result.manifest || {}, evidence = result.evidence || {}, lanes = evidence.lanes || {};
  const sampling = manifest.coverage?.visual_sampling || {}, frames = sampling.frames || [];
  const speech = observations(lanes.spoken_audio), screenText = [...observations(lanes.burned_in_captions), ...observations(lanes.other_on_screen_text)];
  const uniqueText = [...new Set(screenText.map(x => x.text).filter(x => typeof x === 'string' && x.trim()))];
  const visuals = observations(lanes.visible_actions_subjects_ui_state);
  const changes = visuals.filter(x => ['regional_visual_state_change','visual_state_change','major_visual_state_change'].includes(x.state));
  const overview = [Number.isFinite(manifest.duration_seconds) ? 'Your video is ' + timeLabel(manifest.duration_seconds) + ' long.' : 'The video length could not be confirmed.'];
  overview.push(unavailable(lanes.spoken_audio) ? 'The speech transcript is unavailable for this run.' : speech.length ? 'I recovered ' + speech.length + ' speech passage' + (speech.length === 1 ? '' : 's') + '. Read them in order below and listen before relying on an exact quote.' : 'No speech wording was recovered. This does not establish that the video is silent.');
  overview.push(uniqueText.length ? 'I recovered ' + uniqueText.length + ' different piece' + (uniqueText.length === 1 ? '' : 's') + ' of on-screen text in the pictures checked.' : 'No readable on-screen text was recovered in the pictures checked. Text between those pictures may be missing.');
  if (changes.length) overview.push(changes.length + ' visual change' + (changes.length === 1 ? ' was' : 's were') + ' detected between checked pictures. These are places to inspect, not explanations of the actions.');
  const coverage = (frames.length ? (frames.length <= 8 ? 'Pictures were checked at ' + frames.map(x => timeLabel(x.source_timestamp_seconds)).join(', ') + '.' : frames.length + ' pictures were checked' + (Number.isFinite(sampling.interval_seconds) ? ', about ' + sampling.interval_seconds + ' seconds apart.' : '.')) : 'No checked pictures are available.')
    + ' Visual actions, cuts or brief text between these times may be missed.';
  const timeline = [], byId = new Map();
  const pictureReview=result.visual_review;
  const descriptions=new Map(pictureReview?.state==='available'&&pictureReview.source_sha256===manifest.content_sha256?(pictureReview.notes||[]).filter(note=>note.release?.decision==='supported'&&note.release.description_supported===true&&note.release.source_time_image_checks===true).map(note=>[note.observation_id,note]):[]);
  if(descriptions.size)overview.push('I added descriptions of '+descriptions.size+' selected picture'+(descriptions.size===1?'':'s')+'. Other checked pictures remain below for you to inspect. This does not establish every action between pictures.');
  if(descriptions.size&&pictureReview.coverage?.inspected>descriptions.size)overview.push('Descriptions for '+(pictureReview.coverage.inspected-descriptions.size)+' other selected pictures could not be confirmed and are left out.');
  for (const [name, lane] of Object.entries(lanes)) {
    for (const item of observations(lane)) {
      const note = {id:item.observation_id, time:when(item), title:names[name] || 'Video note', text:describeObservation(name,item), label:observationLabel(name,item), lane:name};
      const description=descriptions.get(item.observation_id);
      if(name==='visible_actions_subjects_ui_state'&&description?.source_timestamp_seconds===note.time){note.title='What is shown';note.text=description.description;if(description.change&&description.release.change_supported===true&&description.frame_refs?.length===2)note.text+=' Compared with the picture at '+timeLabel(description.frame_refs[0].source_timestamp_seconds)+': '+description.change;note.label=note.title+' at '+timeLabel(note.time);}
      if (note.id) byId.set(note.id, note);
      // The transcript already presents these passages; duplicated ASR is not
      // independent speaker evidence. Keep IDs available for old corrections.
      if (name !== 'speaker_turns'&&!(name==='visible_actions_subjects_ui_state'&&descriptions.size&&!description)) timeline.push(note);
    }
  }
  timeline.sort((a,b) => (Number.isFinite(a.time) ? a.time : Infinity) - (Number.isFinite(b.time) ? b.time : Infinity));
  const checks = (evidence.modality_conflicts || []).filter(item => item.type === 'spoken_caption_disagreement').map(item => ({time:when(item),text:'The saved speech and on-screen wording disagree here. Listen and check the picture; neither version has been confirmed as correct.'}));
  if (!checks.length && speech.length) checks.push({text:'Check the spoken wording before quoting or editing from it. Automatic transcription can get words wrong.'});
  return {overview,coverage,timeline,byId,checks,limits:[
    'A full review of the story, hook, pacing, delivery, product proof, calls to action and B-roll needs is not available in this version.',
    'Picture descriptions cover selected moments. Following actions between them, explaining a complete workflow, finding repeated work or errors, and recommending improvements still need the deeper video-understanding stage.',
    'Reusable shot recommendations, stock suitability and performance judgments are also unfinished. These basic notes do not grade your video or decide what to cut.'
  ]};
}
