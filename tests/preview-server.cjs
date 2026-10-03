const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { transaction } = require('./helpers/app-harness.cjs');
const seed = [
  transaction({ id:'demo-salary', type:'income', date:'2026-10-01', category:'Gaji', description:'Gaji contoh Oktober', amount:28681000 }),
  transaction({ id:'demo-house', date:'2026-10-01', category:'Kewajiban & Cicilan', description:'Cicilan rumah contoh', amount:5012278, bankReference:'DEMO-1' }),
  transaction({ id:'demo-lunch', date:'2026-10-02', category:'Konsumsi Harian (Makan & Minum)', description:'Makan siang contoh', amount:45000, bankReference:'DEMO-2' }),
  transaction({ id:'demo-train', date:'2026-10-03', amount:22000 }),
  transaction({ id:'demo-save', date:'2026-10-01', category:'Tabungan & Investasi', description:'Tabungan contoh', amount:6680000 }),
  transaction({ id:'demo-gift', date:'2026-10-02', category:'Sosial, Donasi & Hadiah', amount:1240000 }),
  transaction({ id:'demo-utils', date:'2026-10-03', category:'Utilitas & Langganan', amount:421800 }),
  transaction({ id:'demo-cashback', date:'2026-10-03', category:'Utilitas & Langganan', type:'income', amount:140000 }),
  ...[7,8,9].flatMap(month => [
    transaction({ id:`demo-income-${month}`, date:`2026-0${month}-01`, category:'Gaji', type:'income', amount:27000000 + month * 100000 }),
    transaction({ id:`demo-expense-${month}`, date:`2026-0${month}-12`, amount:18500000 + month * 200000 }),
  ]),
];
const stores = new Map();
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.ttf':'font/ttf', '.txt':'text/plain', '.csv':'text/csv' };

function serve(port, fixtures) {
  http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const json = (status, value) => { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(value)); };
    if (url.pathname.startsWith('/.netlify/functions/') || url.pathname === '/api/transactions.php') {
      if (!fixtures) return json(503, { error:'Preview lokal tidak menjalankan Netlify Functions. Tidak ada koneksi ke database atau AI live.' });
      let body = '';
      for await (const chunk of req) body += chunk;
      let payload;
      try { payload = body ? JSON.parse(body) : {}; } catch { return json(400, {error:'Invalid JSON'}); }
      if (url.pathname.endsWith('transactions') || url.pathname.endsWith('transactions.php')) {
        const workspace = req.headers['x-app-workspace'] || 'uji-ui';
        if (!stores.has(workspace)) stores.set(workspace, JSON.parse(JSON.stringify(seed)));
        if (req.method === 'PUT') stores.set(workspace, payload.transactions);
        return json(200, { transactions:stores.get(workspace) });
      }
      if (url.pathname.endsWith('parse-transaction')) {
        if ((payload.text || '').includes('uji gagal')) return json(504, { error:'Timeout simulasi' });
        return json(200, { provider:'nexos', transaction:{ date:'2026-10-03', type:'expense', category:'Konsumsi Harian (Makan & Minum)', description:'Makan siang hasil fixture agent', amount:45000, source:'nexos', confidence:.96 } });
      }
      if (url.pathname.endsWith('parse-bank-statement')) {
        return json(200, { provider:'nexos', transactions:[
          { date:'2026-10-01', type:'expense', category:'Kewajiban & Cicilan', description:'Cicilan rumah contoh', amount:5012278, reference:'DEMO-1', confidence:.95 },
          { date:'2026-10-02', type:'expense', category:'Konsumsi Harian (Makan & Minum)', description:'Makan siang contoh', amount:46000, reference:'DEMO-2', confidence:.85 },
          { date:'2026-10-03', type:'expense', category:'Transport', description:'Parkir contoh hasil dokumen', amount:10000, reference:'DEMO-3', confidence:.91 },
        ] });
      }
      return json(404, { error:'Unknown fixture endpoint' });
    }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!target.startsWith(root + path.sep) || !mime[path.extname(target)] || /(?:^|[\\/])(?:node_modules|\.git|\.netlify|api|netlify)[\\/]/.test(target)) return json(404, {error:'Not found'});
    try {
      let content = fs.readFileSync(target);
      if (fixtures && target === path.join(root,'index.html')) content = Buffer.from(content.toString()
        .replace('<body>', '<body><div style="position:fixed;bottom:4px;left:12px;z-index:8;background:var(--surface);color:var(--muted);font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:4px">Uji lokal: data contoh, AI disimulasikan</div>')
        .replace('id="workspaceInput"', 'id="workspaceInput" value="uji-ui"')
        .replace('id="accessTokenInput"', 'id="accessTokenInput" value="fixture-only"'));
      res.writeHead(200, { 'Content-Type':mime[path.extname(target)], 'Cache-Control':'no-store' }); res.end(content);
    } catch { json(404, {error:'Not found'}); }
  }).listen(port, '127.0.0.1', () => console.log(`Preview ${fixtures ? 'fixtures' : 'application'}: http://127.0.0.1:${port}/`));
}
serve(4175, true);
serve(4176, false);
