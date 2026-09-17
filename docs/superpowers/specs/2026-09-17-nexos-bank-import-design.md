# Nexos Bank Import Design

## Goal

Memindahkan agent impor mutasi bank dari Gemini ke Nexos AI dengan model `DeepSeek V4.1 Flash` tanpa mengubah alur tinjau, rekonsiliasi, dan penyimpanan transaksi yang sudah ada.

## Scope

- Hanya endpoint `parse-bank-statement` yang memakai Nexos.
- Chat dan voice tetap memakai provider yang sudah berjalan.
- CSV/Excel dikirim sebagai teks.
- Gambar dikirim sebagai multimodal image input.
- PDF teks diekstrak di browser sebagai baris terstruktur. PDF hasil scan dirender menjadi gambar JPEG per halaman agar tidak mengirim PDF mentah ke model chat.
- Maksimal enam halaman PDF diproses, dengan resolusi dan kualitas JPEG dibatasi untuk menjaga ukuran request serta waktu inferensi.
- Hasil tetap melalui layar review dan rekonsiliasi `Baru`, `Sudah ada`, atau `Berubah` sebelum disimpan.

## API Contract

Netlify Function membaca `NEXOS_API_KEY` dan opsional `NEXOS_MODEL`, dengan default `DeepSeek V4.1 Flash`. Function memanggil `https://api.nexos.ai/v1/chat/completions` memakai payload OpenAI-compatible dan meminta JSON terstruktur.

Payload aplikasi menerima salah satu dari:

- `documentText` untuk CSV/Excel.
- `documentImages[]` berisi `mimeType` dan base64 untuk PDF atau gambar.

Respons mempertahankan bentuk `statement` dan `transactions` yang dipakai UI saat ini.

## Reliability

- Ukuran total gambar dan teks divalidasi di server.
- Fetch ke Nexos memiliki timeout agar Netlify mengembalikan JSON yang jelas sebelum platform memutus request dengan HTML 504.
- Error HTML dari upstream tidak ditampilkan mentah di UI.
- Respons model tetap divalidasi dan dinormalisasi sebelum dikirim ke browser.

## Verification

- Unit test memastikan URL, authorization, model, input teks/gambar, parsing JSON, dan error provider.
- Seluruh test aplikasi dijalankan.
- Deploy production diverifikasi melalui Netlify CLI dan endpoint live diuji tanpa mengekspos API key.
