import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const page=await readFile(new URL('../public/control/my-work/index.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('My Work page is mobile, source-backed, automatically refreshed and read-only',()=>{
  assert.match(page,/Private · read-only/);
  assert.match(page,/Current work/);
  assert.match(page,/Approved for later/);
  assert.match(page,/Verified completion/);
  assert.match(page,/Source evidence/);
  assert.match(page,/@media\(max-width:640px\)/);
  assert.match(page,/setInterval\(load,60000\)/);
  assert.doesNotMatch(page,/data-action="approve"|data-action="reject"|Route this|<textarea/i);
});

test('My Work embedded JavaScript parses',()=>assert.doesNotThrow(()=>new Script(script,{filename:'public/control/my-work/index.html'})));

test('My Work API and page stay behind existing admin authentication',async()=>{
  const source=await readFile(new URL('../src/control-worker.js',import.meta.url),'utf8');
  const admin=source.indexOf('if(!await isAdmin(request,env))');
  assert.ok(admin>=0);
  assert.ok(source.indexOf("path==='/control/my-work'",admin)>admin);
  assert.ok(source.indexOf("path==='/api/control/my-work'",admin)>admin);
});
