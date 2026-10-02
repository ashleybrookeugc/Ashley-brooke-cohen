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

test('routing status names truthful work stages and keeps technical detail separate', () => {
  assert.match(page,/reading current Project Truth and checking its policy/);
  assert.match(page,/No change is written unless it creates an approval item/);
  assert.match(page,/Technical detail/);
  assert.match(page,/Routing did not produce an approved structured result\. No change was saved/);
  assert.doesNotMatch(page,/Routing…/);
});

test('write outcomes explain verification in plain English before technical detail', () => {
  assert.match(page,/Mary Kate made the approved change and confirmed the exact result in GitHub/);
  assert.match(page,/Mary Kate could not verify this change as complete\. Nothing was recorded as successful/);
});

test('embedded-script syntax guard rejects a literal escaped newline between statements', () => {
  const malformed = "const loaded = true;\\nload();";
  assert.throws(() => new Script(malformed), SyntaxError);
});
