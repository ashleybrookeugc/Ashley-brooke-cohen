import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('actual Worker serves the video page assets and starts the private-access check', {timeout:45000}, async t => {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const persistence = await mkdtemp(join(tmpdir(), 'mk-video-assets-'));
  const config = JSON.parse(await readFile(join(repo,'wrangler.jsonc'),'utf8'));
  // This test exercises static routing without a live private-network connection.
  // Keep the real asset bindings/configuration; VPC transport is tested separately.
  delete config.vpc_services;
  config.vars={...config.vars,ADMIN_PASSWORD:"local-auth-fixture-only",ADMIN_SESSION_SECRET:"local-session-fixture-only-0123456789"};
  config.main = join(repo,config.main);
  config.assets.directory = join(repo,config.assets.directory);
  for (const db of config.d1_databases || []) db.migrations_dir = join(repo,db.migrations_dir);
  const configPath = join(persistence,'static-config.json');
  await writeFile(configPath,JSON.stringify(config));
  const child = spawn(process.execPath, [
    join(repo, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--config', configPath, '--local',
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
  assert.deepEqual(await session.json(),{configured:true,authenticated:false});
  const loginPage=await fetch(base+'/admin/login?returnTo=/video-test/');
  assert.match(await loginPage.text(),/action="\/admin\/login\?returnTo=\/video-test\/"/);
  const rejected=await fetch(base+'/admin/login?returnTo=/video-test/',{method:'POST',body:new URLSearchParams({password:'wrong'}),redirect:'manual'});
  assert.equal(rejected.status,401);assert.equal(rejected.headers.get('set-cookie'),null);
  const login=await fetch(base+'/admin/login?returnTo=/video-test/',{method:'POST',body:new URLSearchParams({password:config.vars.ADMIN_PASSWORD}),redirect:'manual'});
  assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/video-test/');
  const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/HttpOnly; Secure; SameSite=Strict; Max-Age=28800/);
  const cookie=setCookie.split(';')[0];
  assert.deepEqual(await (await fetch(base+'/api/video-test/session',{headers:{cookie}})).json(),{configured:true,authenticated:true});
  // With no analyzer binding this is an authenticated offline response, not 401.
  assert.equal((await fetch(base+'/api/video-test/health',{headers:{cookie}})).status,503);
  assert.equal((await fetch(base+'/api/video-test/jobs')).status,401);
  const logout=await fetch(base+'/admin/logout',{headers:{cookie},redirect:'manual'});
  assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.deepEqual(await (await fetch(base+'/api/video-test/session',{headers:{cookie:'abc_admin='}})).json(),{configured:true,authenticated:false});
});
