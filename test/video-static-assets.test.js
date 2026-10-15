import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('actual Worker serves the video page assets and starts the private-access check', {timeout:45000}, async t => {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const persistence = await mkdtemp(join(tmpdir(), 'mk-video-assets-'));
  const child = spawn(process.execPath, [
    join(repo, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--local',
    '--ip', '127.0.0.1', '--port', '0', '--inspector-port', '0',
    '--persist-to', persistence
  ], {cwd:repo, env:{...process.env, WRANGLER_SEND_METRICS:'false'}, stdio:['ignore','pipe','pipe']});
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {await stopped;} finally {clearTimeout(deadline);}
  });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error('Local Worker startup timed out: '+output.slice(-1500))), 30000);
    const capture = chunk => {
      output += chunk.toString();
      const ready = output.match(/Ready on (http:\/\/(?:127\.0\.0\.1|localhost):\d+)/);
      if (ready) {clearTimeout(deadline);resolve(ready[1]);}
    };
    child.stdout.on('data',capture);child.stderr.on('data',capture);
    child.once('error', error => {clearTimeout(deadline);reject(error);});
    child.once('exit', code => {clearTimeout(deadline);reject(Error('Local Worker exited '+code+': '+output.slice(-1500)));});
  });
  const page = await fetch(base+'/video-test/');
  assert.equal(page.status,200);
  const html = await page.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/video-test\/(?:app\.js|style\.css)[^"]*)"/g)].map(match => match[1]);
  assert.equal(assets.length,2,'Check the actual script and stylesheet referenced by the served HTML');
  for (const path of assets) {
    const response = await fetch(base+path);
    assert.equal(response.status,200,'Worker-first asset must load: '+path);
    const expected = await readFile(join(repo,'public',new URL(path,base).pathname));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected,'Serve the checked-in asset bytes');
  }
  const session = await fetch(base+'/api/video-test/session');
  assert.equal(session.status,200);
  assert.equal(typeof (await session.json()).configured,'boolean');
});
