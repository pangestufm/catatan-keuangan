// Bundles the Three.js desk (finance-stage.mjs) into one classic script, vendor/finance-stage.js,
// so the dashboard keeps working when index.html is opened from disk. Run after changing finance-stage.mjs.
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
esbuild.buildSync({
  entryPoints: [path.join(root, 'finance-stage.mjs')],
  outfile: path.join(root, 'vendor/finance-stage.js'),
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  legalComments: 'eof',
  logLevel: 'info',
});
