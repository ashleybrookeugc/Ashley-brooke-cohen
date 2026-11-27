import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const configPath = 'eval/promptfooconfig.yaml';
const config = readFileSync(configPath, 'utf8');
const providerIds = [...config.matchAll(/^\s*- id:\s*(\S+)/gm)].map(match => match[1]);
if (providerIds.length !== 1 || providerIds[0] !== 'file://providers/local-routing.js') {
  console.error('Refusing to run: the phrasing config must contain only the local routing provider.');
  process.exit(1);
}

const bin = 'node_modules/.bin/promptfoo';
if (!existsSync(bin)) {
  console.error('promptfoo is not installed. From the repository root, run npm install.');
  process.exit(1);
}

const output = '/tmp/promptfoo-phrasing.json';
const env = {...process.env, PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_DISABLE_UPDATE: '1', PROMPTFOO_DISABLE_SHARING: '1'};
for (const name of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CONTROL_MODEL_API_KEY', 'PROMPTFOO_ENABLE_PAID_MODELS']) delete env[name];

const run = spawnSync(bin, ['eval', '-c', configPath, '--no-cache', '--no-table', '--no-write', '--no-share', '--no-progress-bar', '-o', output, '--max-concurrency', '1'], {env, stdio: 'inherit'});
const status = run.status === null ? 1 : run.status;
let raw = null;
try { raw = JSON.parse(readFileSync(output, 'utf8')); } catch { raw = null; }
const rows = raw?.results?.results || raw?.results || [];
const list = Array.isArray(rows) ? rows : [];
const failed = list.filter(row => row.success === false || row.pass === false);
let promptfooVersion = null;
try { promptfooVersion = JSON.parse(readFileSync('node_modules/promptfoo/package.json', 'utf8')).version; } catch { promptfooVersion = null; }
const receipt = {
  date: '2026-10-31',
  command: 'npm run eval:phrasing',
  config: configPath,
  provider: 'file://providers/local-routing.js',
  promptfoo_version: promptfooVersion,
  promptfoo_exit: status,
  cases: list.length,
  failed: failed.length,
  passed: list.length - failed.length,
  failures: failed.map(row => ({description: row.description || row.testCase?.description || null, reason: row.error || row.gradingResult?.reason || null})),
  boundary: 'Local triage, ambiguity gate, and zero-call priority capture only. No paid model call, no network provider, and the existing node test receipts stay in place.',
};
mkdirSync('docs/test-receipts', {recursive: true});
writeFileSync('docs/test-receipts/2026-10-31-promptfoo-phrasing.json', JSON.stringify(receipt, null, 2) + '\n');
process.exit(status);
