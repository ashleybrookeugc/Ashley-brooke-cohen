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
  const manifest=result.manifest||{},lanes=result.evidence?.lanes||{},frames=manifest.coverage?.visual_sampling?.frames||[];
  const byId=new Map();
  // Retain old observation IDs for historical corrections; raw extraction is
  // not a user-facing finding and is not promoted to verified speech or text.
  for(const [name,lane] of Object.entries(lanes))for(const item of observations(lane)){
    if(item.observation_id)byId.set(item.observation_id,{id:item.observation_id,time:when(item),title:names[name]||'Earlier note',text:describeObservation(name,item),label:observationLabel(name,item)});
  }
  const pictures=result.visual_review;
  const pictureNotes=pictures?.state==='available'&&pictures.source_sha256===manifest.content_sha256?(pictures.notes||[]).filter(x=>x.release?.description_supported===true&&x.release.source_time_image_checks===true):[];
  const content=result.content_review;
  const ready=content?.state==='available'&&content.source_sha256===manifest.content_sha256;
  const overview=ready?content.summary.map(x=>x.text):['A complete content review is not ready for this saved run. The earlier text and speech extraction was not reliable enough to present as a transcript.'];
  const transcript=ready?(content.transcript?.segments||[]).map(x=>({id:x.id,time:x.time,end:x.end,text:x.text,title:'Transcript',label:'Transcript at '+timeLabel(x.time)})):[];
  const screenText=ready?(content.screen_text||[]).map(x=>({id:x.id,time:x.time,text:x.text,title:'Words on screen',label:'Words on screen at '+timeLabel(x.time)})):[];
  for(const note of [...transcript,...screenText])byId.set(note.id,note);
  const timeline=ready?content.moments.map(x=>({time:x.time,text:x.text,title:'Key moment',id:x.refs.find(id=>byId.has(id))})):[];
  const detailNotes=pictureNotes.map(x=>({id:x.observation_id,time:x.source_timestamp_seconds,title:'What is shown',text:x.description+(x.change&&x.release.change_supported===true?' '+x.change:''),label:'What is shown at '+timeLabel(x.source_timestamp_seconds)}));
  for(const note of detailNotes)byId.set(note.id,note);
  // Keep distinct picture detail accessible without flooding the main review
  // with near-identical sampled still descriptions.
  const visualDetails=detailNotes.filter((x,i)=>i===0||x.text!==detailNotes[i-1].text);
  const checks=ready?[{text:'Automatic transcription and descriptions can still make mistakes. Use the timestamps to listen or look, and correct any wording that is wrong.'}]:[];
  if(ready&&content.transcript?.withheld)checks.push({text:content.transcript.withheld+' unclear speech passage(s) were left out rather than guessed.'});
  const coverage=frames.length+' pictures sampled across '+timeLabel(manifest.duration_seconds)+'. Brief text and actions between these pictures may be missed.';
  return {overview,transcript,screenText,timeline,visualDetails,byId,correctable:[...transcript,...screenText,...visualDetails],checks,coverage,ready,transcriptState:ready?content.transcript?.state:'not_run',limits:[
    'This review explains the recovered content. Detailed advice on the hook, pacing, editing, product proof, calls to action, workflow and reusable shots is still unfinished.'
  ]};
}
