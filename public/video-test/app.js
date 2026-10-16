import {buildReview, timeLabel} from './review.js?v=20261016-plain';
const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['access','status','file','video','selected','analyze','progress','refresh','runs','storage','review','boundary','overview','checks','capabilities','coverage','frames','lanes','correction','observation','time','text','feedback-status','feedback'].map(id=>[id,$(id)]));
let selected=null,objectURL=null,current=null,connected=false,authenticated=false,busy=false,poll=0,db=null;
const cache=new Map();
function message(text){ui.status.textContent=text;}
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
async function storage(){
  return new Promise((resolve,reject)=>{const request=indexedDB.open('mk-video-review-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('reviews',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function persist(run){
  cache.set(run.id,run);
  if(!db)throw Error('Browser storage is unavailable. Feedback has not been saved.');
  return new Promise((resolve,reject)=>{const tx=db.transaction('reviews','readwrite');tx.objectStore('reviews').put(run);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
async function api(path,options={}){
  const response=await fetch('/api/video-test'+path,{credentials:'same-origin',...options});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;
}
function updateAnalyze(){ui.analyze.disabled=!selected||!connected||busy;ui.file.disabled=busy;}
function playback(file){if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);ui.video.src=objectURL;}
ui.video.addEventListener('error',()=>{ui.selected.textContent='This browser cannot play the selected codec. The analyzer may still support it; no preview or understanding is claimed.';});
ui.file.onchange=async()=>{
  const file=ui.file.files[0]||null;if(!file)return;
  if(current?.result&&!connected){
    if(file.size>64*1048576){ui.selected.textContent='Select the original test clip (up to 64 MiB).';return;}
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==current.result.manifest.content_sha256){ui.selected.textContent='This file does not match the cached evidence. Choose the original file or reconnect to start a new test.';return;}
    playback(file);ui.selected.textContent=file.name+' · exact source identity verified for cached review';return;
  }
  selected=file;clearTimeout(poll);current=null;ui.review.hidden=true;playback(selected);ui.selected.textContent=selected.name+' · '+(selected.size/1048576).toFixed(1)+' MiB · local preview';updateAnalyze();
};
function showRuns(jobs=[]){
  ui.runs.replaceChildren();const all=new Map([...cache.values()].map(r=>[r.id,r.job]));for(const job of jobs)all.set(job.id,job);
  for(const job of all.values()){const b=element('button',decodeName(job.name)+' · '+job.state);b.onclick=()=>openRun(job);ui.runs.append(b);}
  if(!all.size)ui.runs.textContent='No recorded runs yet.';
}
function decodeName(name){try{return decodeURIComponent(name)}catch{return name||'Video'}}
async function refresh(){
  connected=false;try{const session=await api('/session');if(!session.configured){authenticated=false;ui.access.hidden=true;message('Mary Kate sign-in is not configured. Analysis is unavailable.');showRuns();return;}authenticated=session.authenticated;ui.access.hidden=authenticated;if(!authenticated){message('Sign in to Mary Kate to analyze videos. Your selected video stays on this device.');showRuns();return;}
    const health=await api('/health');connected=health.state==='available';message(connected?'Analyzer connected. Ready to upload a test video.':'Analyzer unavailable. No analysis will run; local playback and cached review remain available.');
    const jobs=(await api('/jobs')).jobs;showRuns(jobs);
    if(current)await syncFeedback(current);
    else if(connected&&!selected&&!busy){const latest=jobs.filter(job=>job.state==='completed').sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))[0];if(latest)await openRun(latest);}
  }catch(error){message(error.message+' Cached evidence and corrections remain on this browser.');showRuns();}finally{updateAnalyze();}
}
ui.refresh.onclick=refresh;
ui.analyze.onclick=()=>{
  if(!selected||busy||!connected)return;
  if(selected.size>64*1048576){ui.progress.textContent='This test supports files up to 64 MiB. Choose a shorter clip.';return;}
  busy=true;updateAnalyze();ui.progress.textContent='Sending your selected video securely to your Mac for analysis…';
  const xhr=new XMLHttpRequest();xhr.open('POST','/api/video-test/jobs');xhr.setRequestHeader('content-type','application/octet-stream');xhr.setRequestHeader('x-video-name',encodeURIComponent(selected.name));
  xhr.upload.onprogress=event=>{ui.progress.textContent=event.lengthComputable?'Uploading: '+Math.round(event.loaded/event.total*100)+'% (upload only; analysis has not completed).':'Uploading…';};
  xhr.onerror=()=>{busy=false;connected=false;updateAnalyze();ui.progress.textContent='Connection lost. No completed analysis confirmed. Refresh recent runs before retrying.';};
  xhr.onload=async()=>{try{const job=JSON.parse(xhr.responseText);if(xhr.status!==202)throw Error(job.error||'Upload failed');ui.progress.textContent='Upload finished. Your Mac is checking the video.';await openRun(job,true);}catch(error){busy=false;updateAnalyze();ui.progress.textContent=error.message;}};xhr.send(selected);
};
async function openRun(job,keepPlayback=false){
  clearTimeout(poll);current=cache.get(job.id)||{id:job.id,job,feedback:[]};current.job=job;const run=current;ui.review.hidden=true;
  if(!keepPlayback){if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}ui.video.removeAttribute('src');ui.video.load();selected=null;updateAnalyze();if(connected)ui.video.src='/api/video-test/jobs/'+job.id+'/media';ui.selected.textContent=decodeName(job.name)+(connected?' · saved video on your Mac':' · source offline; select the original again for playback');}
  try{
    if(!connected){if(current.result)render(current);return;}
    const latest=await api('/jobs/'+job.id);if(current?.id!==job.id)return;run.job=latest;busy=['running','uploading'].includes(latest.state);updateAnalyze();
    ui.progress.textContent=latest.state==='completed'?'Basic video notes are ready. The full creative and workflow review is still unfinished.':latest.error||'Analyzer '+latest.state+' · last checked '+new Date().toLocaleTimeString();
    if(latest.state==='completed'){
      run.result=await api('/jobs/'+job.id+'/result');if(current?.id!==job.id)return;
      try{await persist(run);}catch(error){ui.storage.textContent=error.message;}
      render(run);await syncFeedback(run);
    }else if(latest.state==='running'||latest.state==='uploading')poll=setTimeout(()=>openRun(latest,true),2000);
  }catch(error){busy=false;updateAnalyze();ui.progress.textContent=error.message;if(current?.id===job.id&&current.result)render(current);}
}
function seek(time){if(Number.isFinite(time)){ui.video.currentTime=time;ui.time.value=time;}}
function render(run){
  ui.review.hidden=false;const {manifest}=run.result;const report=buildReview(run.result);
  ui.boundary.textContent='These are basic video notes, not a creative verdict. Keep your original video. A full review of the story, actions and editing choices is still unfinished.';
  ui.overview.replaceChildren();for(const text of report.overview)ui.overview.append(element('p',text));
  ui.checks.replaceChildren();for(const check of report.checks){const p=element('article');if(Number.isFinite(check.time)){const b=element('button','Watch '+timeLabel(check.time));b.onclick=()=>seek(check.time);p.append(b);}p.append(element('p',check.text));ui.checks.append(p);}
  ui.capabilities.replaceChildren();for(const text of report.limits)ui.capabilities.append(element('p',text));
  ui.coverage.textContent=report.coverage;
  const frames=manifest.coverage?.visual_sampling?.frames||[];
  ui.frames.replaceChildren();frames.forEach((frame,index)=>{const card=element('div',undefined,'frame');if(connected){const img=element('img');img.src='/api/video-test/jobs/'+run.id+'/frames/'+index;img.alt='Picture checked at '+timeLabel(frame.source_timestamp_seconds);img.loading='lazy';card.append(img);}else card.append(element('p','Picture unavailable while your Mac is disconnected'));const b=element('button','Watch '+timeLabel(frame.source_timestamp_seconds));b.onclick=()=>seek(frame.source_timestamp_seconds);card.append(b);ui.frames.append(card);});
  ui.lanes.replaceChildren();ui.observation.replaceChildren(new Option('The video overall','general'));const seen=new Set();
  for(const note of report.byId.values()){if(!seen.has(note.id)){seen.add(note.id);ui.observation.append(new Option(note.label,note.id));}}
  for(const note of report.timeline){const item=element('article');item.append(element('h4',note.title));if(Number.isFinite(note.time)){const b=element('button','Watch '+timeLabel(note.time));b.onclick=()=>seek(note.time);item.append(b);}item.append(element('p',note.text));if(note.id){const b=element('button','Correct this note');b.onclick=()=>{ui.observation.value=note.id;ui.time.value=Number.isFinite(note.time)?note.time:0;ui.text.focus();};item.append(b);}ui.lanes.append(item);}
  if(!report.timeline.length)ui.lanes.append(element('p','No moment-by-moment notes were recovered. This is not evidence that nothing happened in the video.'));
  ui.time.max=manifest.duration_seconds;renderFeedback(run);
}
function renderFeedback(run){const notes=buildReview(run.result).byId;ui.feedback.replaceChildren();for(const f of run.feedback||[]){const item=element('article');item.append(element('p',timeLabel(f.timestamp_seconds)+' · '+(notes.get(f.observation_id)?.title||'Your video review')),element('p',f.text),element('p',f.synced?'Saved on your Mac and retrieved successfully.':'Saved in this browser; waiting to send to your Mac.','muted'));ui.feedback.append(item);}}
async function syncFeedback(run){
  if(!connected)return;
  try{
    for(const f of run.feedback.filter(x=>!x.synced)){await api('/jobs/'+run.id+'/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f)});}
    const remote=(await api('/jobs/'+run.id+'/feedback')).feedback;
    const combined=new Map(run.feedback.map(f=>[f.id,f]));for(const f of remote)combined.set(f.id,{...f,synced:true});run.feedback=[...combined.values()];await persist(run);if(current?.id===run.id)renderFeedback(run);
  }catch(error){ui['feedback-status'].textContent='Feedback sync not confirmed: '+error.message;}
}
ui.correction.onsubmit=async event=>{
  event.preventDefault();if(!current?.result)return;const run=current;
  const feedback={id:crypto.randomUUID(),source_sha256:run.result.manifest.content_sha256,observation_id:ui.observation.value,timestamp_seconds:Number(ui.time.value),text:ui.text.value.trim(),synced:false};
  if(!feedback.text||feedback.timestamp_seconds<0||feedback.timestamp_seconds>run.result.manifest.duration_seconds)return;
  run.feedback.push(feedback);try{await persist(run);ui.text.value='';ui['feedback-status'].textContent='Correction saved on this browser.';renderFeedback(run);await syncFeedback(run);}catch(error){run.feedback=run.feedback.filter(x=>x.id!==feedback.id);ui['feedback-status'].textContent=error.message;}
};
void (async()=>{try{db=await storage();const request=db.transaction('reviews').objectStore('reviews').getAll();await new Promise((resolve,reject)=>{request.onsuccess=()=>{request.result.forEach(r=>cache.set(r.id,r));resolve()};request.onerror=()=>reject(request.error)});ui.storage.textContent='Cached evidence and pending corrections are stored in this browser. Clearing website data removes that cache; worker-saved feedback remains retrievable.';}catch{ui.storage.textContent='Browser storage unavailable. Offline correction saving is unavailable.';}})();
await refresh();
