#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../.video-analysis-runtime');
const python = resolve(root, 'venv/bin/python');
const marker = resolve(root, 'asr-runtime-version');
const required = 'pocketsphinx-5.0.4-v1';

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', rejectPromise);
    child.on('close', code => code === 0 ? resolvePromise() : rejectPromise(new Error(`${command} exited with ${code}`)));
  });
}

if (await exists(python) && await exists(marker) && (await readFile(marker, 'utf8')).trim() === required) {
  console.log(`ASR runtime ready: ${python}`);
  process.exit(0);
}
await mkdir(root, { recursive: true });
await run('python3', ['-m', 'venv', resolve(root, 'venv')]);
await run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '-r', resolve(here, 'requirements-asr.txt')]);
await writeFile(marker, `${required}\n`);
console.log(`ASR runtime installed: ${python}`);
