/* install-vsix.js
   - Reads package.json to get name and version
   - Builds expected vsix filename: <name>-<version>.vsix
   - Installs it via `code --install-extension <path>`
*/

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(...args) { console.log('[install-vsix]', ...args); }

const extRoot = path.resolve(__dirname, '..');
const pkgPath = path.join(extRoot, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found at', pkgPath);
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const name = pkg.name;
const version = pkg.version;
if (!name || !version) {
  console.error('name or version missing in package.json');
  process.exit(1);
}

const vsixName = `${name}-${version}.vsix`;
const vsixPath = path.join(extRoot, 'bin', 'release', vsixName);
if (!fs.existsSync(vsixPath)) {
  console.error('vsix not found:', vsixPath);
  process.exit(1);
}

try {
  log('Installing', vsixPath);
  execSync(`code --install-extension "${vsixPath}"`, { stdio: 'inherit' });
  //log('Installed');
} catch (err) {
  console.error('install failed:', err.message || err);
  process.exit(1);
}
