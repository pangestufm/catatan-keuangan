const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build output');
if (fs.existsSync(output)) {
  if (fs.realpathSync(output) !== output) throw new Error('Build output must not be a symlink');
  fs.rmSync(output, { recursive: true, force: true });
}
fs.mkdirSync(output);
for (const file of ['index.html', 'styles.css', 'app.js', 'dashboard-ui.js',
  'bank-document.js', 'bank-reconciliation.js', 'currency-input.js', 'vendor']) {
  fs.cpSync(path.join(root, file), path.join(output, file), { recursive: true });
}
console.log('Production frontend built in dist/');
