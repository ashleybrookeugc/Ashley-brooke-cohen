import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const page = await readFile(new URL('../public/control/index.html', import.meta.url), 'utf8');
const embeddedControlScript = html => {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'control page must contain an embedded script');
  return match[1];
};

test('control dashboard explicitly binds every startup DOM dependency', () => {
  for (const id of ['context-status','refresh-context','thought','send','result','projects','needs','ai','history']) {
    assert.match(page, new RegExp("document\\.getElementById\\('" + id + "'\\)"));
  }
});

test('embedded control-page JavaScript parses before the Worker serves it', () => {
  assert.doesNotThrow(() => new Script(embeddedControlScript(page), {filename:'public/control/index.html'}));
});

test('embedded-script syntax guard rejects a literal escaped newline between statements', () => {
  const malformed = "const loaded = true;\\nload();";
  assert.throws(() => new Script(malformed), SyntaxError);
});
