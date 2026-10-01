import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('checked-in Wrangler configuration preserves enabled Workers Observability logs',async()=>{
  const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.observability.enabled,true);
  assert.equal(config.observability.logs.invocation_logs,true);
});
