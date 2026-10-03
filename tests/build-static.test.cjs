const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('build produksi menyertakan aset aplikasi tanpa server fixture atau berkas internal', () => {
  const result = spawnSync(process.execPath, ['scripts/build-static.cjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = path.join(root, 'dist');
  for (const file of ['index.html', 'styles.css', 'app.js', 'dashboard-ui.js', 'bank-document.js',
    'bank-reconciliation.js', 'currency-input.js', 'vendor/xlsx.full.min.js',
    'vendor/lucide.min.js', 'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs',
    'vendor/fonts/ibm-plex-sans-400.ttf']) {
    assert.ok(fs.existsSync(path.join(output, file)), file);
    assert.deepEqual(fs.readFileSync(path.join(output, file)), fs.readFileSync(path.join(root, file)));
  }
  for (const file of ['tests', 'docs', 'design-preview', 'anti-slop', 'api', '.netlify', '.git',
    'node_modules', 'netlify', 'package.json', '.env']) {
    assert.equal(fs.existsSync(path.join(output, file)), false, file);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), /fixture-only|AI disimulasikan/);
});
