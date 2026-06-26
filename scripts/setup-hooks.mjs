import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitDir = path.join(root, '.git');

// Skip when installed as a dependency (no .git present)
if (!fs.existsSync(gitDir)) process.exit(0);

const hooksDir = path.join(gitDir, 'hooks');
const hookDest = path.join(hooksDir, 'prepare-commit-msg');
const hookSrc = path.join(root, '.github', 'hooks', 'prepare-commit-msg');

if (fs.existsSync(hookDest)) process.exit(0);

fs.mkdirSync(hooksDir, { recursive: true });
fs.copyFileSync(hookSrc, hookDest);
fs.chmodSync(hookDest, '755');
console.log('✓ DCO hook installed (Signed-off-by auto-appended to commits)');
