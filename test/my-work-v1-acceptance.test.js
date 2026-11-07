import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMyWorkProjection} from '../src/control/my-work.js';

// Original V1 authority: founder-intent item 10 (plain-language state projection)
// and Second Brain Control Plane (fresh current-state reconciliation).
// These are deliberately RED acceptance regressions until implemented.
// Do not loosen the assertions to make CI green.
const sha='a'.repeat(40);
const source=`# Active Work
## Current active workstreams
### Mary Kate — **ACTIVE NOW**
**Current:** Website main \`be17a17\` contains Cloudflare worker telemetry. 115/115 regressions pass; D1 receipt unverified; provider @cf/meta/llama-3.1-8b-instruct-fp8.
**Next bounded action:** implement the existing Save key workflow against frozen case E.
## Session handoff rule
`;

test('V1: user-facing project summary translates engineering evidence to plain English',()=>{
  const {work}=buildMyWorkProjection({activeWork:source,activeSha:sha});
  const summary=work[0].summary;
  assert.ok(typeof summary==='string' && summary.trim(), 'must explain status');
  assert.doesNotMatch(summary, /\b[0-9a-f]{7,40}\b|\b\d+\/\d+\b|\bD1\b|@cf\/|\btelemetry\b/i,
    'technical receipts must stay in source evidence, not primary user-facing summary');
});

test('V1: an unverified historical next step cannot be presented as current',()=>{
  const {work}=buildMyWorkProjection({activeWork:source,activeSha:sha});
  assert.notEqual(work[0].next, 'implement the existing Save key workflow against frozen case E.',
    'without supersession/freshness verification, old Next text must be marked unverified rather than current');
});
