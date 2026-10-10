const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['access','login','token','status','file','video','selected','analyze','progress','refresh','runs','storage','review','boundary','coverage','frames','lanes','raw','correction','observation','time','text','feedback-status','feedback'].map(id=>[id,$(id)]));
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
ui.login.onsubmit=async event=>{event.preventDefault();try{await api('/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:ui.token.value})});ui.token.value='';await refresh();}catch(error){message(error.message)}};
function showRuns(jobs=[]){
  ui.runs.replaceChildren();const all=new Map([...cache.values()].map(r=>[r.id,r.job]));for(const job of jobs)all.set(job.id,job);
  for(const job of all.values()){const b=element('button',decodeName(job.name)+' · '+job.state);b.onclick=()=>openRun(job);ui.runs.append(b);}
  if(!all.size)ui.runs.textContent='No recorded runs yet.';
}
function decodeName(name){try{return decodeURIComponent(name)}catch{return name||'Video'}}
async function refresh(){
  connected=false;try{const session=await api('/session');authenticated=session.authenticated;ui.access.hidden=authenticated;if(!authenticated){message('Connect with your private testing token. Local video selection remains available.');showRuns();return;}
    const health=await api('/health');connected=health.state==='available';message(connected?'Analyzer connected. Ready to upload a test video.':'Analyzer unavailable. No analysis will run; local playback and cached review remain available.');
    showRuns((await api('/jobs')).jobs);if(current)await syncFeedback(current);
  }catch(error){message(error.message+' Cached evidence and corrections remain on this browser.');showRuns();}finally{updateAnalyze();}
}
ui.refresh.onclick=refresh;
ui.analyze.onclick=()=>{
  if(!selected||busy||!connected)return;
  if(selected.size>64*1048576){ui.progress.textContent='This test supports files up to 64 MiB. Choose a shorter clip.';return;}
  busy=true;updateAnalyze();ui.progress.textContent='Uploading selected file to your authorized analyzer worker…';
  const xhr=new XMLHttpRequest();xhr.open('POST','/api/video-test/jobs');xhr.setRequestHeader('content-type','application/octet-stream');xhr.setRequestHeader('x-video-name',encodeURIComponent(selected.name));
  xhr.upload.onprogress=event=>{ui.progress.textContent=event.lengthComputable?'Uploading: '+Math.round(event.loaded/event.total*100)+'% (upload only; analysis has not completed).':'Uploading…';};
  xhr.onerror=()=>{busy=false;connected=false;updateAnalyze();ui.progress.textContent='Connection lost. No completed analysis confirmed. Refresh recent runs before retrying.';};
  xhr.onload=async()=>{try{const job=JSON.parse(xhr.responseText);if(xhr.status!==202)throw Error(job.error||'Upload failed');ui.progress.textContent='Uploaded. Analyzer is running; no percentage estimate is available.';await openRun(job,true);}catch(error){busy=false;updateAnalyze();ui.progress.textContent=error.message;}};xhr.send(selected);
};
async function openRun(job,keepPlayback=false){
  clearTimeout(poll);current=cache.get(job.id)||{id:job.id,job,feedback:[]};current.job=job;const run=current;ui.review.hidden=true;
  if(!keepPlayback){if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}ui.video.removeAttribute('src');ui.video.load();selected=null;updateAnalyze();if(connected)ui.video.src='/api/video-test/jobs/'+job.id+'/media';ui.selected.textContent=decodeName(job.name)+(connected?' · worker source':' · source offline; select the original again for playback');}
  try{
    if(!connected){if(current.result)render(current);return;}
    const latest=await api('/jobs/'+job.id);if(current?.id!==job.id)return;run.job=latest;busy=['running','uploading'].includes(latest.state);updateAnalyze();
    ui.progress.textContent=latest.state==='completed'?'Evidence extraction completed. Creative understanding has not been established.':latest.error||'Analyzer '+latest.state+' · last checked '+new Date().toLocaleTimeString();
    if(latest.state==='completed'){
      run.result=await api('/jobs/'+job.id+'/result');if(current?.id!==job.id)return;
      try{await persist(run);}catch(error){ui.storage.textContent=error.message;}
      render(run);await syncFeedback(run);
    }else if(latest.state==='running'||latest.state==='uploading')poll=setTimeout(()=>openRun(latest,true),2000);
  }catch(error){busy=false;updateAnalyze();ui.progress.textContent=error.message;if(current?.id===job.id&&current.result)render(current);}
}
function seek(time){if(Number.isFinite(time)){ui.video.currentTime=time;ui.time.value=time;}}
function render(run){
  ui.review.hidden=false;const {manifest,evidence}=run.result;
  ui.boundary.textContent='Actual sampled evidence, not a creative verdict. Visual meaning and creative findings are unavailable in this analyzer. Human review is separate. Never delete the original based on this test.';
  const sampling=manifest.coverage.visual_sampling;
  ui.coverage.textContent=manifest.duration_seconds.toFixed(2)+' seconds · '+sampling.frame_count+' sampled frames · '+sampling.interval_seconds+' second sampling interval. '+evidence.sampling_disclosure;
  ui.frames.replaceChildren();sampling.frames.forEach((frame,index)=>{const card=element('div',undefined,'frame');if(connected){const img=element('img');img.src='/api/video-test/jobs/'+run.id+'/frames/'+index;img.alt='Sample at '+frame.source_timestamp_seconds+' seconds';img.loading='lazy';card.append(img);}else card.append(element('p','Frame image offline'));const b=element('button',frame.source_timestamp_seconds.toFixed(3)+'s');b.onclick=()=>seek(frame.source_timestamp_seconds);card.append(b);ui.frames.append(card);});
  ui.lanes.replaceChildren();ui.observation.replaceChildren(new Option('General review','general'));const seen=new Set();
  for(const [name,lane] of Object.entries(evidence.lanes)){
    const section=element('div');section.append(element('h3',name.replaceAll('_',' ')),element('p','State: '+lane.state));
    const observations=lane.observations||lane.spans||lane.raw_observations||[];
    if(!observations.length)section.append(element('p','No observations supplied in this lane.','muted'));
    for(const observation of observations){const item=element('article');const time=observation.source_timestamp_seconds??observation.start_seconds??observation.timestamp_seconds;const id=observation.observation_id;
      if(Number.isFinite(time)){const b=element('button',time.toFixed(3)+'s');b.onclick=()=>seek(time);item.append(b);}
      item.append(element('pre',JSON.stringify(observation,null,2)));
      if(id&&!seen.has(id)){seen.add(id);ui.observation.append(new Option(name+' · '+id,id));const b=element('button','Flag / correct');b.onclick=()=>{ui.observation.value=id;ui.time.value=Number.isFinite(time)?time:0;ui.text.focus();};item.append(b);}section.append(item);
    }ui.lanes.append(section);
  }
  ui.raw.textContent=JSON.stringify(run.result,null,2);ui.time.max=manifest.duration_seconds;renderFeedback(run);
}
function renderFeedback(run){ui.feedback.replaceChildren();for(const f of run.feedback||[]){const item=element('article');item.append(element('p',f.timestamp_seconds+'s · '+f.observation_id),element('p',f.text),element('p',f.synced?'Saved and retrieved from analyzer worker.':'Saved on this browser; waiting to sync.','muted'));ui.feedback.append(item);}}
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
try{db=await storage();const request=db.transaction('reviews').objectStore('reviews').getAll();await new Promise((resolve,reject)=>{request.onsuccess=()=>{request.result.forEach(r=>cache.set(r.id,r));resolve()};request.onerror=()=>reject(request.error)});ui.storage.textContent='Cached evidence and pending corrections are stored in this browser. Clearing website data removes that cache; worker-saved feedback remains retrievable.';}catch{ui.storage.textContent='Browser storage unavailable. Offline correction saving is unavailable.';}
await refresh();
