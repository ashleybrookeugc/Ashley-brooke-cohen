import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const page=await readFile(new URL('../public/control/my-work/index.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('My Work page is the mobile Command Center and keeps its projections read-only',()=>{
  assert.match(page,/Private Command Center/);
  assert.match(page,/Today/);
  assert.match(page,/All projects/);
  assert.match(page,/Live AI workers/);
  assert.match(page,/Scheduled tasks/);
  assert.match(page,/Needs your attention/);
  assert.match(page,/What works/);
  assert.match(page,/Still blocked or unverified/);
  assert.match(page,/Current verified next step/);
  assert.match(page,/Technical details/);
  assert.match(page,/@media\(max-width:640px\)/);
  assert.match(page,/setInterval\(load,60000\)/);
  assert.doesNotMatch(page,/data-action="approve"|data-action="reject"/i);
});

test('Mary Kate chat remains available from anywhere through the existing guarded interaction route',()=>{
  assert.match(page,/id="chat-toggle"/);
  assert.match(page,/id="chat-drawer"/);
  assert.match(page,/<textarea[^>]+id="chat-input"/);
  assert.match(page,/\/api\/control\/interactions/);
  assert.match(page,/context_workstream:'mary-kate-command-center'/);
  assert.match(page,/No project change happens without the existing approval checks/);
});

test('chat preserves safe structured failures instead of replacing every response with a generic message',()=>{
  assert.match(page,/function chatFailure/);
  assert.match(page,/data\.error/);
  assert.match(page,/prior_state_ambiguous_scope/);
  assert.match(page,/Nothing was recorded as successful/);
});

test('worker activity is loaded separately from projects and never fabricates a live state',()=>{
  assert.match(page,/\/api\/control\/workers/);
  assert.match(page,/Disconnected/);
  assert.match(page,/Result not independently verified/);
  assert.match(page,/Worker activity is unavailable/);
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
