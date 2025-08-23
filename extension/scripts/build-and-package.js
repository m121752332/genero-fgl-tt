/*
  build-and-package.js
  - Deletes and recreates bin/release
  - Runs esbuild (npm run esbuild)
  - Runs vsce package (npm run package)
  - Moves the generated .vsix to bin/release

  This script is cross-platform (uses Node fs and child_process).
*/

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(...args) { console.log('[build-and-package]', ...args); }

const root = __dirname; // extension/scripts
const extRoot = path.resolve(root, '..');
const releaseDir = path.join(extRoot, 'bin', 'release');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(p)) {
      rmrf(path.join(p, name));
    }
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

try {
  log('Cleaning release directory:', releaseDir);
  if (fs.existsSync(releaseDir)) {
    rmrf(releaseDir);
  }
  fs.mkdirSync(releaseDir, { recursive: true });

  log('Running esbuild...');
  execSync('npm run esbuild', { cwd: extRoot, stdio: 'inherit' });

  log('Running vsce package...');
  execSync('npm run package', { cwd: extRoot, stdio: 'inherit' });

  // find the generated .vsix in extRoot
  const files = fs.readdirSync(extRoot);
  const vsix = files.find(f => f.endsWith('.vsix'));
  if (!vsix) {
    throw new Error('No .vsix file found in extension root after packaging');
  }

  const src = path.join(extRoot, vsix);
  const dest = path.join(releaseDir, vsix);
  fs.renameSync(src, dest);
  log('Moved', vsix, '->', dest);

  log('Done.');
} catch (err) {
  console.error('[build-and-package] Error:', err.message || err);
  process.exit(1);
}
