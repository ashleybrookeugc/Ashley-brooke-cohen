import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');

test('normal successful admin login opens the private control plane', () => {
  assert.match(worker, /function loginDestination\([\s\S]*?'\/control\/'/);
  assert.match(worker, /Location:loginDestination\(r\)/);
  assert.doesNotMatch(worker, /async function login\([\s\S]*?Location:'\/moderation\/'/);
});

test('moderation remains an independently protected direct route', () => {
  assert.match(worker, /path\.startsWith\('\/moderation'\)/);
  assert.match(worker, /path==='\/moderation'/);
});

test('video login return is allowlisted and preserved on form submission', () => {
  const helper=worker.slice(worker.indexOf('function loginDestination('),worker.indexOf('function loginPageFor('));
  const destination=new Function(helper+';return loginDestination;')();
  for(const target of ['https://evil.example','//evil.example','/control/','/video-test/?redirect=evil','/video-test/../admin/']){
    assert.equal(destination(new Request('https://test.example/admin/login?returnTo='+encodeURIComponent(target))),'/control/');
  }
  assert.equal(destination(new Request('https://test.example/admin/login?returnTo=/video-test/')),'/video-test/');
  assert.match(worker,/action="\/admin\/login\?returnTo=\/video-test\/"/);
});
