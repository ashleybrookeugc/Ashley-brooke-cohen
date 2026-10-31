#!/usr/bin/env node
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../.video-analysis-runtime');
const python = resolve(root, 'venv/bin/python');
const marker = resolve(root, 'asr-runtime-version');
const required = 'faster-whisper-1.2.1+av-16.1.0+rapidocr-3.10.0-ppocrv6+scenedetect-0.7.2+imagehash-4.3.2-v1';

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function run(command, args, { allowFailure = false } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => {
      stderr.push(chunk);
      process.stderr.write(chunk);
    });
    child.on('error', rejectPromise);
    child.on('close', code => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8')
      };
      if (code !== 0 && !allowFailure) {
        rejectPromise(new Error(`${command} exited with ${code}`));
      } else {
        resolvePromise(result);
      }
    });
  });
}

async function selectPython() {
  for (const command of ['python3.12', 'python3.11', 'python3']) {
    const result = await run(command, ['-c', 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")'], { allowFailure: true }).catch(() => null);
    if (!result || result.code !== 0) continue;
    const version = result.stdout.trim();
    if (version === '3.11' || version === '3.12') return command;
  }
  throw new Error('The video analyzer runtime needs Python 3.11 or 3.12 on PATH (python3.12, python3.11, or python3). Python 3.13 and 3.14 are not used: wheels for this stack have failed to build there.');
}

if (await exists(python) && await exists(marker) && (await readFile(marker, 'utf8')).trim() === required) {
  console.log(`Video analyzer runtime ready: ${python}`);
  process.exit(0);
}

const systemPython = await selectPython();
await mkdir(root, { recursive: true });
if (await exists(resolve(root, 'venv'))) await rm(resolve(root, 'venv'), { recursive: true, force: true });
await run(systemPython, ['-m', 'venv', resolve(root, 'venv')]);
await run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '-r', resolve(here, 'requirements-runtime.txt')]);
await run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--no-deps', 'scenedetect==0.7.2']);
const checked = await run(python, [resolve(here, 'runtime-self-check.py')]);
console.log(checked.stdout.trim());
await run(python, [resolve(here, 'asr-faster-whisper.py'), '--prefetch']);
await writeFile(marker, `${required}\n`);
console.log(`Video analyzer runtime installed: ${python}`);
