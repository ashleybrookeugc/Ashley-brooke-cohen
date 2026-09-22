import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page = await readFile(new URL('../public/control/index.html', import.meta.url), 'utf8');

test('control dashboard explicitly binds every startup DOM dependency', () => {
  for (const id of ['context-status','refresh-context','thought','send','result','projects','needs','ai','history']) {
    assert.match(page, new RegExp("document\\.getElementById\\('" + id + "'\\)"));
  }
});
