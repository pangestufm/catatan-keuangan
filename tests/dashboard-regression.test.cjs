const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, transaction } = require('./helpers/app-harness.cjs');
const rows = [
  transaction({ id:'income', type:'income', category:'Gaji', amount:10000000 }),
  transaction({ id:'transport' }),
  transaction({ id:'food', category:'Konsumsi Harian (Makan & Minum)', amount:5012278 }),
  transaction({ id:'previous', date:'2026-08-01', amount:100000 }),
];

test('kategori memfilter detail tanpa mengubah total bulan dan history tren', t => {
  const app = createApp(rows); t.after(app.close);
  app.setValue('monthFilterInput','2026-09');
  const before = app.get('expenseTotal').textContent;
  app.setValue('categorySummarySelect','Transport');
  assert.equal(app.get('transactionRows').querySelectorAll('.transaction-row').length,1);
  assert.equal(app.get('expenseTotal').textContent,before);
  assert.match(app.get('trendChart').textContent,/Agu 2026/);
  assert.match(app.get('trendChart').textContent,/Sep 2026/);
  assert.equal(app.get('transactionTotal').textContent,'3');
});

test('bulan kosong tidak menghapus data dan semua bulan menampilkan history', t => {
  const app = createApp(rows); t.after(app.close);
  app.setValue('monthFilterInput','2026-10');
  assert.equal(app.get('transactionRows').querySelectorAll('.transaction-row').length,0);
  assert.equal(app.stored().length,4);
  app.get('showAllMonthsButton').click();
  assert.equal(app.get('transactionRows').querySelectorAll('.transaction-row').length,4);
  assert.equal(app.get('transactionTotal').textContent,'4');
});

test('edit nominal Rupiah menjaga identitas dan referensi bank untuk rekonsiliasi ulang', t => {
  const bank = transaction({ source:'Mutasi Bank AI', bankReference:'JAGO-REF-77' });
  const app = createApp([bank]); t.after(app.close);
  app.call('fillForm',bank);
  app.setValue('amountInput','5012278','input');
  assert.equal(app.get('amountInput').value,'5.012.278');
  app.get('transactionForm').requestSubmit();
  const edited = app.stored()[0];
  assert.equal(edited.amount,5012278);
  assert.equal(edited.id,bank.id);
  assert.equal(edited.createdAt,bank.createdAt);
  assert.equal(edited.bankReference,bank.bankReference);
  assert.ok(edited.updatedAt);
});

for (const format of ['csv','xls']) {
  test(`backup ${format} menjaga seluruh history, nominal dan metadata bank`, t => {
    const source = rows.map((row,i)=>({...row, bankReference:`REF-${i}`}));
    const app = createApp(source); t.after(app.close);
    const XLSX = app.window.XLSX;
    app.setValue('monthFilterInput','2026-09');
    const exported = app.call('buildExportRows');
    const sheet = XLSX.utils.aoa_to_sheet(exported);
    let workbook;
    if (format === 'csv') workbook = XLSX.read(XLSX.utils.sheet_to_csv(sheet),{type:'string',cellDates:true});
    else {
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,sheet,'Transaksi');
      workbook = XLSX.read(XLSX.write(wb,{type:'string',bookType:'xlml'}),{type:'string',cellDates:true});
    }
    const imported = app.call('parseWorkbookTransactions',workbook);
    assert.equal(imported.length,source.length);
    source.forEach(row=>{
      const restored=imported.find(item=>item.id===row.id);
      for(const key of ['date','type','category','description','amount','bankReference','createdAt'])
        assert.equal(restored[key],row[key],`${row.id}: ${key}`);
    });
  });
}

test('chat tetap meminta agent dengan konteks lalu menunggu konfirmasi sebelum simpan', async t => {
  const app = createApp(rows); t.after(app.close);
  app.get('chatInput').value='Makan siang 45000';
  await app.call('handleChatSubmit',{preventDefault(){}});
  const request=app.requests.find(r=>r.url.includes('parse-transaction'));
  const payload=JSON.parse(request.body);
  assert.equal(payload.text,'Makan siang 45000');
  assert.equal(payload.recentTransactions.length,4);
  assert.ok(payload.categories.includes('Gaji'));
  assert.equal(app.stored().length,4);
  assert.equal(app.get('draftCard').classList.contains('hidden'),false);
  app.get('confirmDraftButton').click();
  assert.equal(app.stored().length,5);
  assert.equal(app.stored()[0].amount,45000);
});

test('panel catat desktop memakai top layer dialog dan HP memakai konten inline', t => {
  const desktop=createApp(); t.after(desktop.close);
  desktop.call('openQuickEntryModal');
  assert.equal(desktop.get('quickEntryModal').tagName,'DIALOG');
  assert.equal(desktop.get('quickEntryModal').open,true);
  desktop.call('closeQuickEntryModal');
  assert.equal(desktop.get('quickEntryModal').open,false);
  const phone=createApp([], {mobile:true});t.after(phone.close);
  assert.equal(phone.get('entryContent').parentElement.id,'inlineEntryHost');
  phone.call('openDetailTransactions');
  assert.equal(phone.get('detailDialog').open,true);
  assert.equal(phone.get('transactionsSection').parentElement.id,'detailDialog');
});

test('hasil mutasi ditinjau dulu, duplikat dilewati, perubahan dan tambahan tersimpan tepat sekali', async t => {
  const existing=transaction({bankReference:'BANK-1'});
  const changed=transaction({id:'changed',bankReference:'BANK-2',description:'Makan contoh',amount:25000});
  const response={transactions:[
    {...existing,reference:'BANK-1',confidence:.95},
    {...changed,reference:'BANK-2',amount:26000,confidence:.85},
    {date:'2026-09-17',type:'income',category:'Gaji',description:'Tambahan contoh',amount:100000,reference:'BANK-3',confidence:.95},
  ]};
  const app=createApp([existing,changed],{response});t.after(app.close);
  const event={target:{files:[{name:'mutasi.csv',size:300,text:async()=> 'Tanggal,Jenis,Nominal\n2026-09-17,income,100000'}],value:'mutasi.csv'}};
  await app.call('importBankStatementFile',event);
  assert.equal(app.get('bankImportModal').open,true);
  assert.equal(app.stored().length,2);
  assert.equal(app.get('bankImportSelectedCount').textContent,'1');
  assert.equal(app.get('bankImportRows').querySelector('.bank-row-duplicate input').disabled,true);
  const changedSelection=app.get('bankImportRows').querySelector('.bank-row-changed input[data-field="selected"]');
  assert.equal(changedSelection.checked,false);
  changedSelection.checked=true;
  changedSelection.dispatchEvent(new app.window.Event('change',{bubbles:true}));
  assert.equal(app.get('bankImportSelectedCount').textContent,'2');
  app.get('saveBankImportButton').click();
  assert.equal(app.stored().length,3);
  assert.equal(app.stored().find(row=>row.id==='changed').amount,26000);
  await app.call('importBankStatementFile',event);
  assert.equal(app.get('bankImportSelectedCount').textContent,'0');
  assert.equal(app.get('saveBankImportButton').disabled,true);
});

test('konfirmasi hapus tidak mengubah history jika dibatalkan', async t => {
  const app=createApp(rows);t.after(app.close);
  const pending=app.call('clearAllData');
  assert.equal(app.get('confirmDialog').open,true);
  assert.equal(app.stored().length,4);
  app.get('confirmDialog').close('cancel');
  await pending;
  assert.equal(app.stored().length,4);
});

test('hapus yang dikonfirmasi dan ditargetkan hanya menghapus satu catatan', async t => {
  const app=createApp(rows);t.after(app.close);
  app.setValue('monthFilterInput','2026-09');
  const button=app.get('transactionRows').querySelector('[data-id="food"][data-action="delete"]');
  const pending=app.call('handleTableAction',{target:button});
  assert.equal(app.stored().length,4);
  app.get('confirmDialog').close('accept');
  await pending;
  assert.equal(app.stored().length,3);
  assert.equal(app.stored().some(row=>row.id==='food'),false);
});

test('voice mentranskripsikan ke parser agent yang sama dan tidak langsung menyimpan', async t => {
  const app=createApp(rows);t.after(app.close);
  let recognition;
  app.window.SpeechRecognition=class extends app.window.EventTarget {
    constructor() { super(); recognition=this; }
    start() {}
  };
  app.call('startVoiceInput');
  const event=new app.window.Event('result');
  event.results=[[{transcript:'Makan siang 45000'}]];
  recognition.dispatchEvent(event);
  await new Promise(resolve=>setImmediate(resolve));
  recognition.dispatchEvent(new app.window.Event('end'));
  assert.equal(JSON.parse(app.requests[0].body).text,'Makan siang 45000');
  assert.equal(app.stored().length,4);
  assert.equal(app.get('draftCard').classList.contains('hidden'),false);
  assert.equal(app.get('voiceButton').disabled,false);
});

test('penolakan mikrofon memberi pesan dan memulihkan kontrol', t => {
  const app=createApp();t.after(app.close);
  app.window.SpeechRecognition=class extends app.window.EventTarget { start() {throw new Error('permission denied');} };
  app.call('startVoiceInput');
  assert.equal(app.get('voiceButton').disabled,false);
  assert.equal(app.get('chatStatus').dataset.type,'error');
  assert.equal(app.stored().length,0);
});

test('request chat bertumpuk dicegah dan kegagalan agent tidak menyimpan otomatis', async t => {
  let release;
  const app=createApp(rows,{fetch:()=>new Promise(resolve=>{release=resolve;})});t.after(app.close);
  app.get('chatInput').value='uji gagal';
  const first=app.call('handleChatSubmit',{preventDefault(){}});
  await app.call('handleChatSubmit',{preventDefault(){}});
  assert.equal(app.requests.length,1);
  assert.equal(app.get('chatSubmitButton').disabled,true);
  release({ok:false,status:504});
  await first;
  assert.equal(app.stored().length,4);
  assert.equal(app.get('chatSubmitButton').disabled,false);
  assert.equal(app.get('chatStatus').dataset.type,'error');
});

for (const format of ['csv','xls']) test(`file backup ${format} menjaga referensi numerik panjang dan menunggu persetujuan pemulihan`, async t => {
  const original=transaction({id:'0000042',bankReference:'00012345678901234567890'});
  const app=createApp([original]);t.after(app.close);
  app.call(format === 'csv' ? 'exportCsv' : 'exportExcel');
  const csv=await app.downloads[0].text();
  const restore=createApp();t.after(restore.close);
  const event={target:{files:[{name:`backup.${format}`,arrayBuffer:async()=>restore.window.Uint8Array.from(Buffer.from(csv)).buffer}],value:`backup.${format}`}};
  const pending=restore.call('importExcelFile',event);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(restore.get('confirmDialog').open,true);
  assert.equal(restore.stored().length,0);
  restore.get('confirmDialog').close('accept');
  await pending;
  assert.equal(restore.stored()[0].id,original.id);
  assert.equal(restore.stored()[0].bankReference,original.bankReference);
  await restore.call('importExcelFile',event);
  assert.equal(restore.stored().length,1);
  assert.equal(restore.get('confirmDialog').open,false);
});

test('kategori campuran menggunakan arus masuk + keluar, bukan hanya satu sisi', t => {
  const app=createApp([transaction({amount:50000}),transaction({id:'in',type:'income',amount:10000})]);t.after(app.close);
  app.setValue('monthFilterInput','2026-09');
  const card=app.get('categoryBars').querySelector('[data-category="Transport"]');
  assert.match(card.textContent,/60\.000/);
  assert.match(card.textContent,/100% arus dana/);
  assert.match(card.getAttribute('style'),/100%/);
  assert.equal(card.querySelector('.category-rail').previousElementSibling.className,'category-breakdown');
});

test('nominal dan tanggal tidak lengkap tidak lolos penyimpanan manual atau draft', async t => {
  const app=createApp(rows);t.after(app.close);
  app.call('fillForm',transaction());
  app.get('dateInput').value='';
  app.call('handleSubmit',{preventDefault(){}});
  assert.equal(app.stored().length,4);
  app.get('chatInput').value='Makan siang 45000';
  await app.call('handleChatSubmit',{preventDefault(){}});
  app.get('draftDateInput').value='';
  app.get('confirmDraftButton').click();
  assert.equal(app.stored().length,4);
  app.get('draftDateInput').value='2026-09-16';
  app.get('draftAmountInput').value='0';
  app.get('confirmDraftButton').click();
  assert.equal(app.stored().length,4);
});

test('login/sinkronisasi menjaga endpoint, auth workspace dan data di payload', async t => {
  const remote=[transaction()];
  const app=createApp([], {fetch:async(url,request)=>({ok:true,status:200,json:async()=>({transactions:request.method==='PUT'?JSON.parse(request.body).transactions:remote})})});t.after(app.close);
  app.get('workspaceInput').value='uji-online';
  app.get('accessTokenInput').value='fixture-only';
  app.call('handleLoginSubmit',{preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.get('storageStatus').dataset.mode,'online');
  const get=app.requests.find(r=>r.method==='GET');
  assert.equal(get.url,'/.netlify/functions/transactions');
  assert.equal(get.headers['X-App-Workspace'],'uji-online');
  assert.equal(get.headers['X-App-Token'],'fixture-only');
  await app.call('persistRemoteTransactions');
  const put=app.requests.find(r=>r.method==='PUT');
  assert.equal(JSON.parse(put.body).transactions[0].id,remote[0].id);
});

test('kegagalan online mempertahankan data lokal dan menampilkan notice yang terbaca', async t => {
  const app=createApp(rows,{fetch:async()=>{throw new Error('Koneksi uji terputus');}});t.after(app.close);
  await app.call('initializeOnlineStorage');
  assert.equal(app.stored().length,4);
  assert.equal(app.get('storageStatus').dataset.mode,'local');
  // Local-only sessions intentionally do not show an online-failure notice.
  assert.equal(app.get('storageNotice').classList.contains('hidden'),true);
  app.get('workspaceInput').value='regression-fixture';
  app.get('accessTokenInput').value='fixture-only';
  app.call('handleLoginSubmit',{preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.get('storageNotice').classList.contains('hidden'),false);
  assert.match(app.get('storageNotice').textContent,/belum tersinkronkan/);
  assert.equal(app.stored().length,4);
});

test('CSV numerik desimal dan tanggal serial tetap dibaca tanpa mengubah referensi teks', async t => {
  const app=createApp();t.after(app.close);
  const csv='ID,Tanggal,Jenis,Kategori,Deskripsi,Nominal,Referensi Bank\n00001,2026-09-16,expense,Transport,Kereta,45000.00,00012345678901234567890\n00002,46281,expense,Transport,Bus,12000.00,00002';
  const event={target:{files:[{name:'decimal.csv',arrayBuffer:async()=>app.window.Uint8Array.from(Buffer.from(csv)).buffer}],value:'decimal.csv'}};
  const pending=app.call('importExcelFile',event);
  await new Promise(resolve=>setImmediate(resolve));
  app.get('confirmDialog').close('accept');
  await pending;
  assert.equal(app.stored().length,2);
  assert.equal(app.stored().find(row=>row.id==='00001').amount,45000);
  assert.equal(app.stored().find(row=>row.id==='00001').bankReference,'00012345678901234567890');
  assert.equal(app.stored().find(row=>row.id==='00002').date,'2026-09-16');
});

test('backup dihitung ulang jika sync datang selagi konfirmasi masih terbuka', async t => {
  let release;
  const app=createApp([], {fetch:()=>new Promise(resolve=>{release=resolve;})});t.after(app.close);
  app.get('workspaceInput').value='regression-fixture';
  app.get('accessTokenInput').value='fixture-only';
  app.call('handleLoginSubmit',{preventDefault(){}});
  const csv='ID,Tanggal,Jenis,Kategori,Deskripsi,Nominal\nfixture-1,2026-09-16,expense,Transport,Kereta contoh,45000';
  const event={target:{files:[{name:'sync.csv',arrayBuffer:async()=>app.window.Uint8Array.from(Buffer.from(csv)).buffer}],value:'sync.csv'}};
  const pending=app.call('importExcelFile',event);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.get('confirmDialog').open,true);
  release({ok:true,status:200,json:async()=>({transactions:[transaction()]})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.stored().length,1);
  app.get('confirmDialog').close('accept');
  await pending;
  assert.equal(app.stored().length,1);
  assert.equal(app.stored()[0].amount,45000);
});
