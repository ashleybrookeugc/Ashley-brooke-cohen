import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const router=readFileSync(new URL('../src/control-worker.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../public/control/video-test/index.html',import.meta.url),'utf8');
const config=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
test('browser test uses existing authenticated control route',()=>{
 assert.match(router,/if\(!await isAdmin\(request,env\)\)/);
 assert.match(router,/path==='\/control\/video-test'/);
 assert.ok(router.indexOf('if(!await isAdmin')<router.indexOf("path==='/control/video-test'"));
 assert.match(router,/videoBrowserTestPage/);
 assert.match(router,/content-security-policy/);
});
test('browser test has no network upload or paid infrastructure',()=>{
 assert.match(page,/type="file"/);
 assert.match(page,/createObjectURL/);
 assert.match(page,/drawImage/);
 assert.match(page,/loadedmetadata/);
 assert.doesNotMatch(page,/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|R2|WORKER_TOKEN/);
 assert.doesNotMatch(config,/"r2_buckets"|"containers"/);
});
test('existing protected routes and deployment configuration preserved',()=>{
 assert.match(router,/path==='\/control\/my-work'/);
 assert.match(router,/path==='\/api\/control\/state'/);
 assert.match(router,/return app.fetch\(request,env,ctx\)/);
 assert.doesNotMatch(config,/video-testing-build-guard/);
});
