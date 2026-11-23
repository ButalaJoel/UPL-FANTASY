#!/usr/bin/env node
/**
 * One-step setup for Kiwanja. Works on Windows, macOS and Linux.
 *
 *   node scripts/setup.mjs          install, start the database, migrate, seed, then run the apps
 *   node scripts/setup.mjs --no-dev do everything except starting the apps
 *   node scripts/setup.mjs --reset  wipe the database and re-seed the sample data
 *
 * Needs Node.js 20+ and Docker Desktop (for PostgreSQL). If you already run PostgreSQL
 * yourself, set DATABASE_URL in apps/api/.env and the Docker step is skipped.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const isWin = process.platform === 'win32';

const c = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = c('32'), yellow = c('33'), red = c('31'), bold = c('1');
const step = (n, msg) => console.log(`\n${bold(green(`[${n}]`))} ${bold(msg)}`);
const fail = (msg) => {
  console.error(`\n${red('✖ ' + msg)}\n`);
  process.exit(1);
};

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: isWin, ...opts });
  return r.status === 0;
}
const has = (cmd, a = ['--version']) => spawnSync(cmd, a, { stdio: 'ignore', shell: isWin }).status === 0;

function dbTarget() {
  const env = readFileSync(join(root, 'apps/api/.env'), 'utf8');
  const url = /DATABASE_URL\s*=\s*"?([^"\n]+)"?/.exec(env)?.[1] ?? '';
  const u = new URL(url.replace(/^postgresql:/, 'http:'));
  return { host: u.hostname || 'localhost', port: Number(u.port || 5432) };
}

const portOpen = ({ host, port }) =>
  new Promise((resolve) => {
    const s = connect({ host, port });
    s.setTimeout(1500);
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
    s.once('timeout', () => (s.destroy(), resolve(false)));
  });

async function waitForDb(target, seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    if (await portOpen(target)) {
      // The port opens slightly before Postgres accepts logins.
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// 1. Tooling ----------------------------------------------------------------------------
step(1, 'Checking tools');
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) fail(`Node.js 20 or newer is required (you have ${process.versions.node}). Download it from https://nodejs.org`);
console.log(`  Node.js ${process.versions.node}`);
if (!has('pnpm')) {
  console.log(yellow('  pnpm not found, enabling it through Corepack...'));
  if (!run('corepack', ['enable']) || !has('pnpm')) {
    console.log(yellow('  Corepack could not enable pnpm, installing it with npm...'));
    if (!run('npm', ['install', '-g', 'pnpm@10'])) fail('Could not install pnpm. Run "npm install -g pnpm" and try again.');
  }
}
console.log('  pnpm ready');

// 2. Dependencies -----------------------------------------------------------------------
step(2, 'Installing dependencies (first run takes a minute or two)');
if (!run('pnpm', ['install'])) fail('pnpm install failed. See the messages above.');

// 3. Environment ------------------------------------------------------------------------
step(3, 'Preparing environment file');
const envFile = join(root, 'apps/api/.env');
if (!existsSync(envFile)) {
  copyFileSync(join(root, 'apps/api/.env.example'), envFile);
  console.log('  Created apps/api/.env from .env.example');
} else console.log('  apps/api/.env already exists, keeping it');

// 4. Database ---------------------------------------------------------------------------
step(4, 'Starting PostgreSQL');
const target = dbTarget();
if (await portOpen(target)) {
  console.log(`  A database is already listening on ${target.host}:${target.port}`);
} else if (has('docker')) {
  if (!has('docker', ['info'])) fail('Docker is installed but not running. Start Docker Desktop, wait until it says "running", then run this again.');
  if (!run('docker', ['compose', 'up', '-d', 'db'])) fail('Could not start the database container.');
  process.stdout.write('  Waiting for the database');
  if (!(await waitForDb(target))) fail('The database did not start within 60 seconds. Run "docker compose logs db" to see why.');
  console.log(' ready');
} else {
  fail('No database found and Docker is not installed.\n  Install Docker Desktop (https://www.docker.com/products/docker-desktop) or point DATABASE_URL in apps/api/.env at your own PostgreSQL 14+.');
}

// 5. Schema and sample data -------------------------------------------------------------
step(5, 'Creating tables and loading sample data');
if (!run('pnpm', ['--filter', '@kiwanja/api', 'db:generate'])) fail('Prisma client generation failed.');
if (args.has('--reset')) {
  if (!run('pnpm', ['--filter', '@kiwanja/api', 'db:reset'])) fail('Database reset failed.');
} else {
  if (!run('pnpm', ['--filter', '@kiwanja/api', 'db:migrate'])) fail('Database migration failed.');
  if (!run('pnpm', ['--filter', '@kiwanja/api', 'db:seed'])) fail('Seeding failed.');
}

console.log(`
${green(bold('✔ Kiwanja is set up.'))}

  Fantasy app   http://localhost:5173
  Data Ops app  http://localhost:5173/ops
  API           http://localhost:4000/api/health
  Mobile app    run "pnpm dev:mobile" in a second terminal, then scan the QR code
                with Expo Go on a phone on the same Wi-Fi

  Demo logins (password ${bold('kiwanja123')}):
    fan@kiwanja.test          fantasy manager
    admin@kiwanja.test        super admin
    analyst.a@kiwanja.test    match analyst A
    analyst.b@kiwanja.test    match analyst B (verifier)
    supervisor@kiwanja.test   match supervisor
`);

// 6. Run --------------------------------------------------------------------------------
if (args.has('--no-dev')) {
  console.log('Start the apps any time with: pnpm dev');
  process.exit(0);
}
step(6, 'Starting the API and web app (press Ctrl+C to stop)');
const child = spawn('pnpm', ['dev'], { cwd: root, stdio: 'inherit', shell: isWin });
child.on('exit', (code) => process.exit(code ?? 0));
