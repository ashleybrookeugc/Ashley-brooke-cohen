import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../public/control/video-test/index.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

async function exercise(requiresPlayback=false,neverFrame=false){
  assert.ok(script,'exercise the actual inline page script');
  const listeners=new Map(),captures=[];
  const element=id=>({id,textContent:'',disabled:false,files:[],children:[],
    addEventListener(type,fn){listeners.set(id+':'+type,fn)},
    removeEventListener(type){listeners.delete(id+':'+type)},
    replaceChildren(){this.children=[]},append(...children){this.children.push(...children)},
    pause(){},load(){},removeAttribute(){},focus(){}});
  const ids=new Map(['video','file','extract','frames','log','status','load','copy'].map(id=>[id,element(id)]));
  const video=ids.get('video');Object.assign(video,{duration:10,videoWidth:320,videoHeight:180,readyState:3,networkState:1,error:null,decodedTime:0});
  let currentTime=0,staleFirst=true,pendingFrame=null;
  Object.defineProperty(video,'currentTime',{get:()=>currentTime,set(value){currentTime=value;
    // The HTMLMediaElement playhead changes immediately; decoded pixels arrive later.
    staleFirst=true;
    setTimeout(()=>{
      listeners.get('video:seeked')?.();
      // A paused video presents one frame for this seek; a callback registered
      // after seeked will miss it and never fire until another presentation.
      const callback=pendingFrame;pendingFrame=null;
      if(callback){if(requiresPlayback||neverFrame)pendingFrame=callback;else deliver(callback)}
    },5);
  }});
  function deliver(callback){setTimeout(()=>{
    video.decodedTime=staleFirst?0:currentTime;staleFirst=false;
    callback(0,{mediaTime:video.decodedTime});
    if(pendingFrame){const next=pendingFrame;pendingFrame=null;deliver(next)}
  },5)}
  video.requestVideoFrameCallback=callback=>{pendingFrame=callback};
  video.play=()=>{const callback=pendingFrame;pendingFrame=null;if(callback&&!neverFrame){staleFirst=false;deliver(callback)}return Promise.resolve()};
  const document={getElementById:id=>ids.get(id),createElement:tag=>tag==='canvas'
    ? {getContext:()=>({drawImage(){captures.push({playhead:currentTime,decoded:video.decodedTime})}})}
    : {textContent:''}};
  const timer=(fn,ms)=>setTimeout(fn,neverFrame&&ms>=1000?ms===12000?60:10:ms);
  vm.runInNewContext(script,{document,window:{addEventListener(){}},navigator:{userAgent:'test'},location:{protocol:'https:'},URL,Date,setTimeout:timer,clearTimeout,Math,Number,Error,Promise}, {timeout:1000});
  listeners.get('video:loadedmetadata')();
  await listeners.get('extract:click')();
  if(neverFrame){assert.equal(captures.length,0);assert.match(ids.get('status').textContent,/FAILED: Decoded frame not confirmed at 1.00s/);return}
  assert.deepEqual(captures.map(x=>x.playhead),[1,5,9]);
  assert.deepEqual(captures.map(x=>x.decoded),[1,5,9]);
  if(requiresPlayback)assert.match(ids.get('log').textContent,/trying muted playback/);
}

test('canvas capture waits for the decoded frame at each requested source time',()=>exercise());
test('paused decoder can be nudged into presenting a matching frame',()=>exercise(true));
test('missing decoded frame reports failure without displaying an old canvas',()=>exercise(false,true));
