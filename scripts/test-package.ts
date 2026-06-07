#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function run(cmd: string, opts: { cwd?: string; failOk?: boolean } = {}) {
  const result = spawnSync(cmd, { shell: true, cwd: opts.cwd ?? ROOT, encoding: 'utf8' });
  if (!opts.failOk && result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`Command failed (exit ${result.status}): ${cmd}`);
  }
  return result;
}

function check(label: string, result: ReturnType<typeof run>, expectedExit: number) {
  if (result.status !== expectedExit) {
    process.stderr.write(`stdout: ${result.stdout}\nstderr: ${result.stderr}\n`);
    throw new Error(`${label}: expected exit ${expectedExit}, got ${result.status}`);
  }
  console.log(`  ✓  ${label}  (exit ${result.status})`);
}

console.log('==> Building CLI...');
run('npm run build:cli');

console.log('==> Packing...');
const packResult = run('npm pack --json');
const tarball: string = (JSON.parse(packResult.stdout) as Array<{ filename: string }>)[0].filename;
console.log(`    tarball: ${tarball}`);

const tmp = mkdtempSync(join(tmpdir(), 'flaglint-e2e-'));
const proj = join(tmp, 'project');
mkdirSync(proj);
writeFileSync(join(proj, 'package.json'), JSON.stringify({ name: 'e2e', version: '0.0.1', type: 'module' }));
const src = join(proj, 'src');
mkdirSync(src);
writeFileSync(join(src, 'index.ts'), 'const x = 1;\nexport { x };\n');

try {
  console.log('==> Installing tarball...');
  run(`npm install "${join(ROOT, tarball)}" --no-save`, { cwd: proj });

  const bin = join(proj, 'node_modules', '.bin', 'flaglint');

  console.log('==> Verifying commands...');
  check('--version', run(`"${bin}" --version`, { cwd: proj, failOk: true }), 0);
  check('audit (clean src)', run(`"${bin}" audit ./src`, { cwd: proj, failOk: true }), 0);
  check('scan (clean src)', run(`"${bin}" scan ./src`, { cwd: proj, failOk: true }), 0);
  check('migrate --dry-run (clean src)', run(`"${bin}" migrate ./src --dry-run`, { cwd: proj, failOk: true }), 0);
  check('validate (clean src)', run(`"${bin}" validate ./src --no-direct-launchdarkly`, { cwd: proj, failOk: true }), 0);

  // Write a direct LD call so validate exits 1
  writeFileSync(
    join(src, 'violation.ts'),
    [
      "import { init } from 'launchdarkly-node-server-sdk';",
      "const ldClient = init('sdk-key');",
      "void ldClient.boolVariation('checkout-v2', { key: 'user-1' }, false);",
    ].join('\n') + '\n'
  );
  check('validate (with LD violation → exit 1)', run(`"${bin}" validate ./src --no-direct-launchdarkly`, { cwd: proj, failOk: true }), 1);

  console.log('\n==> All package E2E checks passed.');
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(join(ROOT, tarball), { force: true });
}
