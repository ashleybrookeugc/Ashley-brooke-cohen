import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../public/control/video-test/index.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('canvas capture waits for the decoded frame at each requested source time',async()=>{
  assert.ok(script,'exercise the actual inline page script');
  const listeners=new Map(),captures=[];
  const element=id=>({id,textContent:'',disabled:false,files:[],children:[],
    addEventListener(type,fn){listeners.set(id+':'+type,fn)},
    removeEventListener(type){listeners.delete(id+':'+type)},
    replaceChildren(){this.children=[]},append(...children){this.children.push(...children)},
    pause(){},load(){},removeAttribute(){},focus(){}});
  const ids=new Map(['video','file','extract','frames','log','status','load','copy'].map(id=>[id,element(id)]));
  const video=ids.get('video');Object.assign(video,{duration:10,videoWidth:320,videoHeight:180,readyState:3,networkState:1,error:null,decodedTime:0});
  let currentTime=0,staleFirst=true;
  Object.defineProperty(video,'currentTime',{get:()=>currentTime,set(value){currentTime=value;
    // The HTMLMediaElement playhead changes immediately; decoded pixels arrive later.
    staleFirst=true;
    setTimeout(()=>listeners.get('video:seeked')?.(),5);
  }});
  video.requestVideoFrameCallback=callback=>setTimeout(()=>{
    video.decodedTime=staleFirst?0:currentTime;staleFirst=false;
    callback(0,{mediaTime:video.decodedTime});
  },5);
  const document={getElementById:id=>ids.get(id),createElement:tag=>tag==='canvas'
    ? {getContext:()=>({drawImage(){captures.push({playhead:currentTime,decoded:video.decodedTime})}})}
    : {textContent:''}};
  vm.runInNewContext(script,{document,window:{addEventListener(){}},navigator:{userAgent:'test'},location:{protocol:'https:'},URL,Date,setTimeout,clearTimeout,Math,Number,Error,Promise}, {timeout:1000});
  listeners.get('video:loadedmetadata')();
  await listeners.get('extract:click')();
  assert.deepEqual(captures.map(x=>x.playhead),[1,5,9]);
  assert.deepEqual(captures.map(x=>x.decoded),[1,5,9]);
});
