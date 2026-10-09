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
  for (const id of ['context-status','refresh-context','thought','send','result','projects','needs','ai','history','workers','workers-status']) {
    assert.match(page, new RegExp("document\\.getElementById\\('" + id + "'\\)"));
  }
});

test('existing control page presents truthful read-only worker telemetry on mobile', () => {
  assert.match(page,/Worker activity/);
  assert.match(page,/Read-only status for Mary Kate-managed M4 workers/);
  assert.match(page,/Running/);
  assert.match(page,/Idle/);
  assert.match(page,/Execution completed/);
  assert.match(page,/Disconnected/);
  assert.match(page,/Unknown/);
  assert.match(page,/has not been independently verified/);
  assert.match(page,/Model<\/strong><span>/);
  assert.match(page,/Tokens<\/strong><span>/);
  assert.match(page,/Cost<\/strong><span>/);
  assert.match(page,/Unavailable/);
  assert.match(page,/Technical diagnostics/);
  assert.match(page,/@media\(max-width:700px\)/);
  assert.match(page,/worker-metrics\{grid-template-columns:1fr\}/);
  const section=page.match(/<section aria-labelledby="workers-heading">([\s\S]*?)<\/section>\s*<h2>Projects/);
  assert.ok(section);
  assert.doesNotMatch(section[1],/<button/i);
  assert.doesNotMatch(page,/launchWorker|data-worker-action/i);
  assert.match(page,/M4 connected/);
  assert.match(page,/M4 unavailable/);
  assert.match(page,/setInterval\(\(\)=>loadWorkers\(false\),5000\)/);
});

test('production worker inventory remains behind admin auth while ingest uses its narrow signature gate', async () => {
  const source=await readFile(new URL('../src/control-worker.js',import.meta.url),'utf8');
  const ingest=source.indexOf("path==='/api/control/workers/telemetry'");
  const admin=source.indexOf('if(!await isAdmin(request,env))');
  const inventory=source.indexOf("path==='/api/control/workers'&&request.method==='GET'");
  assert.ok(ingest>=0&&ingest<admin&&admin<inventory);
  assert.match(source,/verifyWorkerTelemetrySignature/);
  assert.match(source,/CONTROL_WORKER_TELEMETRY_SECRET/);
  assert.match(source,/if\(request\.method!==\'POST\'\) return json\(\{error:\'Method not allowed\',code:\'read_only\'\},405\);\s*await ensureSchema/);
  assert.doesNotMatch(source,/console\.(?:log|error).*CONTROL_WORKER_TELEMETRY_SECRET/);
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

test('prior-state conflicts explain the stop and Ashley’s next choice before technical evidence', () => {
  assert.match(page,/e\.action\?\.prompt/);
  assert.match(page,/Saved options/);
  assert.match(page,/e\.technical/);
});

test('write outcomes explain verification in plain English before technical detail', () => {
  assert.match(page,/Mary Kate made the approved change and confirmed the exact result in GitHub/);
  assert.match(page,/Mary Kate could not verify this change as complete\. Nothing was recorded as successful/);
});

test('embedded-script syntax guard rejects a literal escaped newline between statements', () => {
  const malformed = "const loaded = true;\\nload();";
  assert.throws(() => new Script(malformed), SyntaxError);
});
