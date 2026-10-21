#!/usr/bin/env node
// Poll bind-mounted dist/ from cosva-iot and restart this service.
// Polling (not fs.watch) because Docker Desktop on macOS often drops events.

import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const pollMs = Number(process.env.DEV_POLL_MS || 200);
const entry = process.env.DEV_ENTRY || 'src/index.js';
const cwd = process.env.DEV_CWD || process.cwd();
const appRoot = process.env.DEV_APP_ROOT || '/app';
const watchFiles = (process.env.DEV_WATCH || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);
const prismaDir = (process.env.DEV_PRISMA || '').trim();

function fileStamp(file) {
  try {
    const stat = statSync(file);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return 'missing';
  }
}

function treeStamp(dir) {
  if (!dir) return '';
  const parts = [];
  const walk = current => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      parts.push(`${current}:missing`);
      return;
    }
    for (const item of entries) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) walk(full);
      else {
        const stat = statSync(full);
        parts.push(`${full}:${stat.mtimeMs}:${stat.size}`);
      }
    }
  };
  walk(dir);
  return parts.join('|');
}

function codeStamp() {
  return watchFiles.map(fileStamp).join('|');
}

let child = null;
let stopping = false;
let restarting = false;
let pendingKind = null;
let refreshing = false;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: appRoot,
      stdio: 'inherit',
      env: process.env,
    });
    proc.on('error', reject);
    proc.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function syncPrisma() {
  if (!prismaDir) return;
  const prisma = path.join(appRoot, 'node_modules/.bin/prisma');
  console.log('[dev] prisma generate');
  await run(prisma, ['generate']);
  if (process.env.DEV_MIGRATE === '0') return;
  console.log('[dev] prisma migrate deploy');
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await run(prisma, ['migrate', 'deploy']);
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }
  throw lastError;
}

function stopChild() {
  if (!child || child.exitCode !== null) return Promise.resolve();
  const proc = child;
  return new Promise(resolve => {
    const timer = setTimeout(() => proc.kill('SIGKILL'), 2000);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
  });
}

function startChild() {
  console.log(`[dev] node ${entry}`);
  const proc = spawn(process.execPath, ['--enable-source-maps', entry], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  child = proc;
  proc.on('exit', (code, signal) => {
    if (child === proc) child = null;
    if (stopping || restarting) return;
    console.log(
      `[dev] node exited (${signal || code}). Waiting for the next file change.`
    );
  });
}

async function flush() {
  if (refreshing || stopping) return;
  refreshing = true;
  try {
    while (pendingKind && !stopping) {
      const kind = pendingKind;
      pendingKind = null;
      if (kind === 'prisma') {
        try {
          await syncPrisma();
        } catch (error) {
          console.error(
            `[dev] prisma failed, keeping the current process: ${error.message}`
          );
          continue;
        }
      }
      console.log(`[dev] ${kind} changed — restarting`);
      restarting = true;
      await stopChild();
      restarting = false;
      if (!stopping) startChild();
    }
  } finally {
    refreshing = false;
    if (pendingKind && !stopping) flush();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDist() {
  const started = Date.now();
  while (watchFiles.some(file => fileStamp(file) === 'missing')) {
    if (Date.now() - started > 120000) {
      console.error(
        '[dev] dist is still missing. Run npm run dev:watch from cosva-iot-app.'
      );
      process.exit(1);
    }
    await sleep(pollMs);
  }
}

async function main() {
  if (watchFiles.length === 0) {
    console.error('[dev] DEV_WATCH is empty');
    process.exit(1);
  }
  await waitForDist();
  try {
    await syncPrisma();
  } catch (error) {
    console.error(`[dev] prisma failed on boot: ${error.message}`);
  }
  startChild();

  let lastCode = codeStamp();
  let lastPrisma = treeStamp(prismaDir);
  let debounce = null;

  while (!stopping) {
    await sleep(pollMs);
    const nextCode = codeStamp();
    const nextPrisma = treeStamp(prismaDir);
    const prismaChanged = nextPrisma !== lastPrisma;
    const codeChanged = nextCode !== lastCode;
    if (!prismaChanged && !codeChanged) continue;
    lastPrisma = nextPrisma;
    lastCode = nextCode;
    pendingKind = prismaChanged ? 'prisma' : 'code';
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      flush().catch(error => console.error(error));
    }, 200);
  }
}

function shutdown() {
  stopping = true;
  stopChild().then(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch(error => {
  console.error(error);
  process.exit(1);
});
