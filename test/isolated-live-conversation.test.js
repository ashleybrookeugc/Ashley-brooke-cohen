import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/control-worker.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../public/control/acceptance-case-e.html',import.meta.url),'utf8');
const start=worker.indexOf("if(path==='/api/control/acceptance/case-e')");
const end=worker.indexOf("await ensureSchema(env)",start);
const block=worker.slice(start,end);
test('isolated canary is behind existing admin auth and origin gate',()=>{
 assert.ok(start>worker.indexOf('if(!await isAdmin(request,env))'));
 assert.match(block,/request.method!=='POST'/);
 assert.match(block,/request.headers.get\('origin'\)/);
 assert.match(block,/createWorkersAiRoutingAdapter\(env\)/);
});
test('canary cannot perform production writes or paid fallback',()=>{
 assert.doesNotMatch(block,/core\.capture|store\.|\.approve\(|\.reject\(|\.put\(|\.run\(|createPolicyRoutingAdapter|createGitHubAdapter|env\.DB|CONTROL_OPENROUTER/);
 assert.match(block,/effects:\{writes:0,approvals:0\}/);
 assert.match(page,/Run one test/);
});
test('canary is explicit and never self-certifies semantic answer quality',()=>{
 assert.match(block,/No independent semantic answer grading/);
 assert.match(block,/route_kind==='temporary_context'/);
 assert.match(block,/!route.proposal/);
 assert.doesNotMatch(block,/status:'PASS'/);
});
