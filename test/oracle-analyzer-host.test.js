import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const root = new URL('../deploy/oracle-analyzer/', import.meta.url);

function run(file, args, env, options = {}) {
  return execFileSync(file, args, {encoding: 'utf8', env: {...process.env, ...env}, ...options});
}

test('firewall editor keeps Oracle iSCSI rules and allows only SSH inbound', () => {
  const dir = execFileSync('mktemp', ['-d'], {encoding: 'utf8'}).trim();
  const rules = join(dir, 'rules.v4');
  const original = [
    '*filter',
    ':INPUT ACCEPT [0:0]',
    ':FORWARD ACCEPT [0:0]',
    ':OUTPUT ACCEPT [0:0]',
    '-A OUTPUT -d 169.254.0.2/32 -p tcp --dport 3260 -m owner --uid-owner 0 -j ACCEPT',
    '-A OUTPUT -d 169.254.2.0/24 -p tcp --dport 3260 -m owner --uid-owner 0 -j ACCEPT',
    '-A OUTPUT -d 169.254.0.2/32 -p tcp --dport 3260 -j DROP',
    '-A OUTPUT -d 169.254.2.0/24 -p tcp --dport 3260 -j DROP',
    'COMMIT',
    ''
  ].join('\n');
  execFileSync('bash', ['-lc', `cat > ${JSON.stringify(rules)}`], {input: original});
  const once = run('python3', [new URL('apply-firewall.py', root).pathname, rules], {});
  assert.match(once, /:INPUT DROP /);
  assert.equal(once.split('oracle-analyzer-ssh').length - 1, 1);
  for (const line of original.split('\n')) {
    if (line.includes('169.254.')) assert.ok(once.includes(line), line);
  }
  execFileSync('bash', ['-lc', `cat > ${JSON.stringify(rules)}`], {input: once});
  const twice = run('python3', [new URL('apply-firewall.py', root).pathname, rules], {});
  assert.equal(twice.split('oracle-analyzer-ssh').length - 1, 1);
  assert.throws(() => run('python3', [new URL('apply-firewall.py', root).pathname, '/dev/null'], {}), /169\.254/);
});

test('update classifier allows only the frozen ASR engine-name failure', () => {
  const dir = execFileSync('mktemp', ['-d'], {encoding: 'utf8'}).trim();
  const tap = join(dir, 'out.tap');
  const script = new URL('update.sh', root).pathname;
  const known = 'ASR preserves tested connector words and negation with versioned word timestamps';
  execFileSync('bash', ['-lc', `cat > ${JSON.stringify(tap)}`], {input: `TAP version 13\nok 1 - decode\nnot ok 2 - ${known}\n`});
  run('bash', [script, '--classify-tap', tap], {});
  execFileSync('bash', ['-lc', `cat > ${JSON.stringify(tap)}`], {input: 'TAP version 13\nnot ok 1 - a new failure\n'});
  assert.throws(() => run('bash', [script, '--classify-tap', tap], {}), /unexpected test failure/);
});

test('corrections backup is disabled by default and never stores raw footage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'oracle-backup-'));
  const data = join(dir, 'data');
  const job = randomUUID();
  await mkdir(join(data, job, 'feedback'), {recursive: true});
  await mkdir(join(data, job, 'frames'), {recursive: true});
  await writeFile(join(data, job, 'source.bin'), 'not-a-real-video');
  await writeFile(join(data, job, 'frames', '0.jpg'), 'not-a-real-frame');
  await writeFile(join(data, job, 'evidence.json'), '{}');
  await writeFile(join(data, job, 'feedback', 'note.json'), '{"text":"the word is fair"}\n');
  const remote = join(dir, 'remote.git');
  execFileSync('git', ['init', '--bare', '-b', 'main', remote]);
  const env = {
    ORACLE_ANALYZER_ENV_FILE: '/dev/null',
    ORACLE_ANALYZER_ROOT: dir,
    ORACLE_ANALYZER_USER: process.env.USER || 'ubuntu',
    VIDEO_TEST_ROOT: data,
    ORACLE_ANALYZER_BACKUP_WORKDIR: join(dir, 'workdir'),
    ORACLE_ANALYZER_BACKUP_BRANCH: 'main'
  };
  const script = new URL('backup-corrections.sh', root).pathname;
  const disabled = run('bash', [script], {...env, ORACLE_ANALYZER_BACKUP_ENABLED: '0'});
  assert.match(disabled, /disabled/);
  assert.equal(existsSync(join(dir, 'workdir')), false);

  run('bash', [script], {
    ...env,
    ORACLE_ANALYZER_BACKUP_ENABLED: '1',
    ORACLE_ANALYZER_BACKUP_TEST: '1',
    ORACLE_ANALYZER_BACKUP_LOCAL_REMOTE: remote
  });
  const files = execFileSync('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'main'], {encoding: 'utf8'});
  assert.match(files, new RegExp(`feedback/${job}/note.json`));
  assert.equal(files.includes('source.bin'), false);
  assert.equal(files.includes('.jpg'), false);
  assert.equal(files.includes('evidence.json'), false);
  const stored = execFileSync('git', ['--git-dir', remote, 'show', `main:feedback/${job}/note.json`], {encoding: 'utf8'});
  assert.match(stored, /fair/);

  await writeFile(join(data, job, 'feedback', 'clip.mp4'), 'nope');
  assert.throws(() => run('bash', [script], {
    ...env,
    ORACLE_ANALYZER_BACKUP_ENABLED: '1',
    ORACLE_ANALYZER_BACKUP_TEST: '1',
    ORACLE_ANALYZER_BACKUP_LOCAL_REMOTE: remote
  }), /refusing/);
  const after = execFileSync('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'main'], {encoding: 'utf8'});
  assert.equal(after.includes('clip.mp4'), false);
  assert.equal(after.includes('source.bin'), false);
});

test('corrections backup can encrypt JSON when an age recipient is configured', {skip: !existsSync('/usr/bin/age') && !existsSync('/bin/age')}, async () => {
  const age = existsSync('/usr/bin/age') ? '/usr/bin/age' : '/bin/age';
  const dir = await mkdtemp(join(tmpdir(), 'oracle-backup-age-'));
  const data = join(dir, 'data');
  const job = randomUUID();
  await mkdir(join(data, job, 'feedback'), {recursive: true});
  await writeFile(join(data, job, 'source.bin'), 'footage');
  await writeFile(join(data, job, 'feedback', 'note.json'), '{"text":"keep this private"}\n');
  const identity = join(dir, 'identity.txt');
  execFileSync('age-keygen', ['-o', identity], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  const pub = (await readFile(identity, 'utf8')).match(/age1[0-9a-z]+/)?.[0];
  assert.ok(pub);
  await writeFile(join(dir, 'recipient.pub'), pub + '\n');
  const remote = join(dir, 'remote.git');
  execFileSync('git', ['init', '--bare', '-b', 'main', remote]);
  const script = new URL('backup-corrections.sh', root).pathname;
  run('bash', [script], {
    ORACLE_ANALYZER_ENV_FILE: '/dev/null',
    ORACLE_ANALYZER_ROOT: dir,
    ORACLE_ANALYZER_USER: process.env.USER || 'ubuntu',
    VIDEO_TEST_ROOT: data,
    ORACLE_ANALYZER_BACKUP_WORKDIR: join(dir, 'workdir'),
    ORACLE_ANALYZER_BACKUP_ENABLED: '1',
    ORACLE_ANALYZER_BACKUP_TEST: '1',
    ORACLE_ANALYZER_BACKUP_LOCAL_REMOTE: remote,
    ORACLE_ANALYZER_BACKUP_AGE_RECIPIENT: join(dir, 'recipient.pub'),
    ORACLE_ANALYZER_BACKUP_BRANCH: 'main'
  });
  const files = execFileSync('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'main'], {encoding: 'utf8'});
  assert.match(files, /note\.json\.age/);
  assert.equal(files.includes('note.json\n') || files.includes(`feedback/${job}/note.json\n`), false);
  assert.equal(files.includes('source.bin'), false);
  const cipher = execFileSync('git', ['--git-dir', remote, 'show', `main:feedback/${job}/note.json.age`]);
  const plain = execFileSync(age, ['-d', '-i', identity], {input: cipher, encoding: 'utf8'});
  assert.match(plain, /keep this private/);
});
