import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');

test('normal successful admin login opens the private control plane', () => {
  assert.match(worker, /async function login\([\s\S]*?Location:'\/control\/'/);
  assert.doesNotMatch(worker, /async function login\([\s\S]*?Location:'\/moderation\/'/);
});

test('moderation remains an independently protected direct route', () => {
  assert.match(worker, /path\.startsWith\('\/moderation'\)/);
  assert.match(worker, /path==='\/moderation'/);
});
