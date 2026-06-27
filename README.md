# Catatan Keuangan

Aplikasi web hybrid untuk mencatat pemasukan dan pengeluaran. Bisa dipakai offline dari komputer, dan bisa online memakai Netlify untuk hosting, serverless function, dan database Netlify Blobs.

## Cara membuka offline

Double-click `Buka Aplikasi.bat`, atau buka `index.html` langsung di browser.

## Setup Online: Netlify

### 1. Upload ke Netlify

Pilihan paling rapi adalah lewat GitHub:

1. Buat repository kosong di GitHub, misalnya `catatan-keuangan`.
2. Dari folder project ini, jalankan:

```bash
git remote add origin https://github.com/USERNAME/catatan-keuangan.git
git push -u origin main
```

3. Di Netlify, pilih `Add new site` > `Import an existing project`.
4. Pilih repository GitHub tadi.
5. Netlify akan membaca `netlify.toml`, memasang dependency `@netlify/blobs`, memakai folder root sebagai static site, serta `netlify/functions` sebagai API.

Pilihan upload manual:

1. Buka https://app.netlify.com/drop.
2. Upload folder aplikasi ini.
3. Setelah site jadi, buka `Site configuration` > `Environment variables`.
4. Tambahkan:

```text
APP_ACCESS_TOKEN=buat_token_rahasia_sendiri
AI_PROVIDER=gemini
GEMINI_API_KEY=isi_dengan_api_key_gemini
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=isi_dengan_api_key_openai
OPENAI_MODEL=gpt-4o-mini
```

5. Deploy ulang site di Netlify.

`AI_PROVIDER` menentukan agent AI untuk fitur catat cepat. Isi `gemini` untuk Gemini atau `openai` untuk OpenAI. Jika memakai Gemini, isi `GEMINI_API_KEY`; `GEMINI_MODEL` opsional dan default-nya `gemini-2.5-flash`. Jika memakai OpenAI, isi `OPENAI_API_KEY`; `OPENAI_MODEL` opsional dan default-nya `gpt-4o-mini`.

### 2. Environment variables

Di Netlify, buka `Site configuration` > `Environment variables`, lalu tambahkan:

```text
APP_ACCESS_TOKEN=buat_token_rahasia_sendiri
AI_PROVIDER=gemini
GEMINI_API_KEY=isi_dengan_api_key_gemini
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=isi_dengan_api_key_openai
OPENAI_MODEL=gpt-4o-mini
```

`APP_ACCESS_TOKEN` wajib untuk mode online. Variabel AI hanya diperlukan jika ingin fitur agent chat/voice memakai Gemini atau OpenAI.

### 3. Migrasi dari Supabase lama

Data baru akan tersimpan di Netlify Blobs. Jika sebelumnya kamu sudah memakai Supabase, biarkan sementara env lama ini tetap ada di Netlify:

```text
SUPABASE_URL=isi_dengan_project_url_supabase
SUPABASE_SERVICE_ROLE_KEY=isi_dengan_service_role_key
```

Saat workspace pertama kali dibuka, function akan membaca data lama dari Supabase, menyalinnya ke Netlify Blobs, lalu setelah itu aplikasi memakai Netlify Blobs. Setelah kamu memastikan data sudah muncul, env Supabase bisa dihapus.

### 4. Login ke aplikasi

Saat membuka web, aplikasi meminta:

- `Workspace`: nama ruang data, contoh `keluarga-ando`.
- `Access token`: isi dari `APP_ACCESS_TOKEN` di Netlify.

Data akan disimpan di Netlify Blobs dengan key `transactions:<workspace>`. Jadi jika repo di-fork, di-clone, atau ada beberapa workspace, catatan tidak saling bentrok selama workspace atau environment Netlify-nya berbeda.

### 5. Cek apakah online aktif

Saat dibuka dari URL Netlify, indikator di header akan berubah menjadi `Mode Online`.
Jika masih `Mode Lokal`, cek:

- Environment variables sudah benar.
- Function `transactions` muncul di menu `Functions` Netlify.
- Kalau diminta token, masukkan isi `APP_ACCESS_TOKEN`.

## Fitur

- Tambah, edit, dan hapus transaksi.
- Summary total pemasukan, pengeluaran, dan saldo bersih.
- Filter bulan aktif untuk summary card, ringkasan kategori, tren, dan detail transaksi.
- Tabel detail transaksi per tanggal dengan filter tanggal di dalam bulan aktif.
- Grafik pengeluaran day-to-day untuk satu bulan.
- Ringkasan per kategori melalui pilihan kategori di card.
- Import `.xlsx` / `.xls` dari format Excel lama:
  - Pemasukan: kolom A uraian, kolom B tanggal, kolom C nominal.
  - Pengeluaran: kolom E uraian, kolom F tanggal, kolom G kategori, kolom H nominal.
- Catat cepat dari chat, contoh: `belanja pizza tanggal 4 200000`.
- Agent AI Gemini/OpenAI untuk membaca konteks chat/voice dengan Structured Outputs. Jika provider AI gagal, aplikasi otomatis fallback ke parser lokal.
- Voice input untuk catat cepat di browser yang mendukung Speech Recognition.
- Draft konfirmasi sebelum transaksi dari chat/voice disimpan.
- Trigger kategori eksplisit, contoh: `beli susu 25000 kategori makanan`.
- Pembelajaran kategori lokal per workspace dari transaksi yang dikonfirmasi atau dikoreksi.
- Dark mode.
- Export `.csv` untuk import ke Google Sheets sekaligus backup yang bisa diimport ulang ke aplikasi.
- Export `.xls` untuk dibuka di Microsoft Excel sekaligus backup yang bisa diimport ulang ke aplikasi.

## Catatan penyimpanan

Mode lokal menyimpan data di browser/perangkat yang sama. Mode online menyimpan data di Netlify Blobs melalui Netlify Function dan tetap mencadangkan data lokal di browser.
