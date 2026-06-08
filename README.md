# Catatan Keuangan

Aplikasi web hybrid untuk mencatat pemasukan dan pengeluaran. Bisa dipakai offline dari komputer, dan bisa online gratis memakai Netlify untuk hosting + Supabase untuk database.

## Cara membuka offline

Double-click `Buka Aplikasi.bat`, atau buka `index.html` langsung di browser.

## Setup Online Gratis: Supabase + Netlify

### 1. Buat database di Supabase

1. Buka https://supabase.com dan buat project baru.
2. Masuk ke `SQL Editor`.
3. Jalankan SQL ini:

```sql
create table if not exists public.app_state (
  state_key text primary key,
  state_value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

revoke all on table public.app_state from anon, authenticated;
grant select, insert, update, delete on table public.app_state to service_role;
```

### 2. Ambil credential Supabase

Di Supabase dashboard, buka `Project Settings` > `API`, lalu salin:

- `Project URL`
- `service_role key`

Jangan taruh `service_role key` di file frontend. Key ini nanti disimpan sebagai environment variable Netlify.

### 3. Upload ke Netlify

Pilihan paling rapi adalah lewat GitHub:

1. Buat repository kosong di GitHub, misalnya `catatan-keuangan`.
2. Dari folder project ini, jalankan:

```bash
git remote add origin https://github.com/USERNAME/catatan-keuangan.git
git push -u origin main
```

3. Di Netlify, pilih `Add new site` > `Import an existing project`.
4. Pilih repository GitHub tadi.
5. Netlify akan membaca `netlify.toml` dan memakai folder root sebagai static site serta `netlify/functions` sebagai API.

Pilihan upload manual:

1. Buka https://app.netlify.com/drop.
2. Upload folder aplikasi ini.
3. Setelah site jadi, buka `Site configuration` > `Environment variables`.
4. Tambahkan:

```text
SUPABASE_URL=isi_dengan_project_url_supabase
SUPABASE_SERVICE_ROLE_KEY=isi_dengan_service_role_key
APP_ACCESS_TOKEN=buat_token_rahasia_sendiri
```

5. Deploy ulang site di Netlify.

### 4. Cek apakah online aktif

Saat dibuka dari URL Netlify, indikator di header akan berubah menjadi `Mode Online`.
Jika masih `Mode Lokal`, cek:

- Environment variables sudah benar.
- Function `transactions` muncul di menu `Functions` Netlify.
- SQL `app_state` sudah dibuat di Supabase.
- Kalau diminta token, masukkan isi `APP_ACCESS_TOKEN`.

## Fitur

- Tambah, edit, dan hapus transaksi.
- Summary total pemasukan, pengeluaran, dan saldo bersih.
- Tabel detail transaksi dengan pencarian, filter jenis, dan filter bulan.
- Ringkasan per kategori melalui pilihan kategori di card.
- Import `.xlsx` / `.xls` dari format Excel lama:
  - Pemasukan: kolom A uraian, kolom B tanggal, kolom C nominal.
  - Pengeluaran: kolom E uraian, kolom F tanggal, kolom G kategori, kolom H nominal.
- Catat cepat dari chat, contoh: `belanja pizza tanggal 4 200000`.
- Voice input untuk catat cepat di browser yang mendukung Speech Recognition.
- Dark mode.
- Export `.csv` untuk import ke Google Sheets.
- Export `.xls` untuk dibuka di Microsoft Excel.

## Catatan penyimpanan

Mode lokal menyimpan data di browser/perangkat yang sama. Mode online menyimpan data di Supabase melalui Netlify Function dan tetap mencadangkan data lokal di browser.
