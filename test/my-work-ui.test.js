import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const page=await readFile(new URL('../public/control/my-work/index.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('My Work page is the mobile Command Center with read-only sources and guarded actions',()=>{
  assert.match(page,/Private Command Center/);
  assert.match(page,/Today/);
  assert.match(page,/All projects/);
  assert.match(page,/Live AI workers/);
  assert.match(page,/Scheduled tasks/);
  assert.match(page,/Needs your attention/);
  assert.match(page,/What works/);
  assert.match(page,/Still blocked or unverified/);
  assert.match(page,/Saved resume point|next_label/);
  assert.match(page,/Technical details/);
  assert.match(page,/@media\(max-width:640px\)/);
  assert.match(page,/setInterval\(load,60000\)/);
  assert.match(page,/data-action="approve"/i);
  assert.match(page,/data-action="reject"/i);
  assert.match(page,/\/api\/control\/items\//);
  assert.match(page,/No approval is waiting right now/);
  assert.doesNotMatch(page,/data-prompt|promptButton|Talk this through/);
  assert.match(page,/class="chat-toggle"/);
  assert.match(page,/id="attention-status"/);
  assert.match(page,/attentionStatus\.textContent=data\.message/);
});

test('iPhone Command Center keeps controls readable, tappable, and inside the viewport',()=>{
  assert.match(page,/viewport-fit=cover/);
  assert.match(page,/-webkit-text-size-adjust:100%/);
  assert.match(page,/button,\.toolbar a,\.nav a\{[\s\S]*?flex:0 0 auto;[\s\S]*?min-height:44px;[\s\S]*?font:800 16px/s);
  assert.match(page,/touch-action:manipulation/);
  assert.match(page,/\.nav\{[\s\S]*?overflow-x:auto;[\s\S]*?-webkit-overflow-scrolling:touch/s);
  assert.match(page,/\.chat-drawer textarea\{[\s\S]*?font:500 16px/s);
  assert.match(page,/@media\(max-width:640px\)\{[\s\S]*?env\(safe-area-inset-bottom\)[\s\S]*?max-height:calc\(100dvh - 10px\)/s);
  assert.match(page,/\.chat-open \.chat-toggle\{display:none\}/);
  assert.match(page,/document\.body\.classList\.toggle\('chat-open',open\)/);
  assert.match(page,/\.lcars-rail/);
});

test('Mary Kate chat remains available from anywhere through the existing guarded interaction route',()=>{
  assert.match(page,/id="chat-toggle"/);
  assert.match(page,/id="chat-drawer"/);
  assert.match(page,/<textarea[^>]+id="chat-input"/);
  assert.match(page,/\/api\/control\/interactions/);
  assert.match(page,/context_workstream:'mary-kate-command-center'/);
  assert.match(page,/refresh_context:true/);
  assert.match(page,/follow up/);
  assert.match(page,/conversation_history:prior/);
  assert.match(page,/conversation_id:conversation\.id/);
  assert.match(page,/sessionStorage/);
  assert.match(page,/id="chat-thread"/);
  assert.match(page,/Clear tracked conversation/);
  assert.match(page,/handoff\?\.status==='tracked'/);
  assert.match(page,/function chatSuccess/);
  assert.match(page,/technical_summary/);
  assert.match(page,/I check the latest saved information before answering/);
  assert.doesNotMatch(page,/Current Project Truth is reread before routing/);
});

test('primary Command Center copy translates backend state before exposing technical evidence',()=>{
  assert.match(page,/Your phone testing is still finding real problems/);
  assert.match(page,/Saved records reread/);
  assert.match(page,/Current priority is separated from older resume plans/);
  assert.match(page,/<details id="suggestion-details" hidden>/);
  assert.match(page,/These may be outdated or wrong\. They are not today’s priorities/);
  assert.doesNotMatch(page,/AI can handle next/);
  assert.match(page,/Changes that were checked after saving/);
  assert.doesNotMatch(page,/Project Truth refreshed/);
  assert.doesNotMatch(page,/verified canonical updates/i);
});

test('chat preserves safe structured failures instead of replacing every response with a generic message',()=>{
  assert.match(page,/function chatFailure/);
  assert.match(page,/prior_state_ambiguous_scope/);
  assert.match(page,/conversation\.messages\.slice\(-8\)\.map/);
  assert.match(page,/text:text\.slice\(0,2000\)/);
  assert.match(page,/I misunderstood your question as a request to change something/);
  assert.doesNotMatch(page,/Routing selected a write target outside the resolved workstream/);
  assert.match(page,/Nothing was recorded as successful/);
});

test('chat shows a bounded transcript and only offers clearing after tracked handoff',()=>{
  assert.match(page,/conversation\.messages=conversation\.messages\.slice\(-12\)/);
  assert.match(page,/chatSessionActions\.hidden=!conversation\.tracked/);
  assert.match(page,/if\(!conversation\.tracked\)return/);
  assert.doesNotMatch(page,/chatResult\.innerHTML|chatResult\.textContent/);
});

test('worker activity is loaded separately from projects and never fabricates a live state',()=>{
  assert.match(page,/\/api\/control\/workers/);
  assert.match(page,/Disconnected/);
  assert.match(page,/Result not independently verified/);
  assert.match(page,/Worker activity is unavailable/);
  assert.doesNotMatch(page,/Herdr connection is not configured|Herdr-managed worker/);
});

test('live worker activity has one bounded task plan instead of a copied progress transcript',()=>{
  assert.match(page,/Live task plan/);
  assert.match(page,/Last confirmed plan/);
  assert.match(page,/function workerPlan\(worker\)/);
  assert.match(page,/worker\.plan/);
  assert.match(page,/This worker has not checked in with a task plan yet/);
  assert.match(page,/This plan is no longer live because the worker connection is stale/);
  assert.doesNotMatch(page,/progress_events\?\.at\(-1\)\.message/);
});

test('Today ties fresh video worker steps to the saved priority without claiming stale or unrelated work',()=>{
  const start=script.indexOf('const isVideoFocus=');
  const end=script.indexOf('function priorityCard(',start);
  assert.ok(start>0&&end>start);
  const activity=new Script('const esc=s=>String(s??"").replaceAll("<","&lt;");'+script.slice(start,end)+';todayActivity').runInNewContext();
  const video={project:'Shared video analyzer',label:'Video processing'};
  const worker={task:{summary:'Repair video analyzer uploads'},identity:{agent_name:'Video worker'},state:'running',state_source:'herdr',plan:{goal:'Verify uploaded-file workflow',steps:[{label:'Inspect the failure',state:'completed'},{label:'Test an upload',state:'current'},{label:'Review result',state:'next'}]}};
  const connected={enabled:true,connection:{state:'connected',fresh:true},workers:[worker]};
  assert.match(activity(video,connected),/Working now:.*Video worker/);
  assert.match(activity(video,connected),/Current step:.*Test an upload/);
  assert.match(activity(video,connected),/Next:.*Review result/);
  assert.doesNotMatch(activity(video,{...connected,connection:{state:'disconnected',fresh:false}}),/Working now:/);
  assert.match(activity(video,{...connected,connection:{state:'disconnected',fresh:false}}),/Herdr is offline/);
  assert.match(activity(video,{...connected,workers:[{...worker,task:{summary:'Cloudflare worker display acceptance'},plan:null}]}),/no video agent has checked in/);
  assert.doesNotMatch(activity(video,{...connected,workers:[{...worker,state:'completed'}]}),/Working now:/);
  assert.doesNotMatch(activity(video,{...connected,workers:[{...worker,plan:null}]}),/Current step:/);
  assert.match(activity(video,null),/Live worker updates are unavailable/);
  assert.equal(activity({project:'Mary Kate / AI operating system'},connected),'');
});

test('technical source records stay in expandable details and errors stay understandable',()=>{
  assert.match(page,/function technical\(item\).*?<details>/s);
  assert.match(page,/The latest next step needs verification/);
  assert.doesNotMatch(page,/error\.message/);
});

test('My Work embedded JavaScript parses',()=>assert.doesNotThrow(()=>new Script(script,{filename:'public/control/my-work/index.html'})));

test('My Work API and page stay behind existing admin authentication',async()=>{
  const source=await readFile(new URL('../src/control-worker.js',import.meta.url),'utf8');
  const admin=source.indexOf('if(!await isAdmin(request,env))');
  assert.ok(admin>=0);
  assert.ok(source.indexOf("path==='/control/my-work'",admin)>admin);
  assert.ok(source.indexOf("path==='/api/control/my-work'",admin)>admin);
});
