# Nexos Bank Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti provider agent impor mutasi bank dengan Nexos `DeepSeek V4.1 Flash` dan mengurangi risiko timeout PDF.

**Architecture:** Netlify Function memakai Nexos Chat Completions dengan keluaran JSON, sementara browser mengekstrak teks PDF atau mengubah PDF scan menjadi kumpulan JPEG terkompresi. Kontrak hasil dan modul rekonsiliasi tetap dipertahankan sehingga review sebelum simpan serta deteksi duplikat tidak berubah.

**Tech Stack:** JavaScript, Netlify Functions, Nexos OpenAI-compatible API, PDF.js, Node test runner.

## Global Constraints

- Gunakan environment variable `NEXOS_API_KEY` dan default model persis `DeepSeek V4.1 Flash`.
- Jangan mengubah provider chat/voice.
- Jangan menyimpan transaksi sebelum user mengonfirmasi hasil review.
- Pertahankan deteksi transaksi baru, duplikat, dan berubah.

---

### Task 1: Nexos Function Contract

**Files:**
- Modify: `tests/parse-bank-statement.test.cjs`
- Modify: `netlify/functions/parse-bank-statement.js`

**Interfaces:**
- Consumes: `documentText` atau `documentImages[]` dari browser.
- Produces: `{ provider, model, statement, transactions }`.

- [ ] Tulis test gagal untuk URL Nexos, bearer token, model, JSON response format, input teks, dan input gambar.
- [ ] Jalankan `node --test tests/parse-bank-statement.test.cjs` dan pastikan gagal karena implementasi masih Gemini.
- [ ] Implementasikan pemanggilan Nexos, validasi payload, timeout, ekstraksi JSON, dan error JSON yang ringkas.
- [ ] Jalankan test yang sama dan pastikan lulus.

### Task 2: Lightweight PDF Input

**Files:**
- Modify: `app.js`
- Create: `vendor/pdf.min.mjs`
- Create: `vendor/pdf.worker.min.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: browser `File` PDF/gambar.
- Produces: `{ documentImages: [{ mimeType, data }], mimeType }` atau payload teks yang sudah ada.

- [ ] Tambahkan dependency PDF.js dan vendor runtime browser yang diperlukan.
- [ ] Implementasikan render maksimal enam halaman PDF menjadi JPEG terkompresi dengan batas payload.
- [ ] Ubah gambar biasa menjadi `documentImages[]` dan perbaiki pesan timeout/HTML error agar tidak membocorkan halaman error mentah.
- [ ] Jalankan syntax check JavaScript dan seluruh test.

### Task 3: Production Verification

**Files:**
- Modify: `README.md` bila dokumentasi environment tersedia di sana.

**Interfaces:**
- Consumes: `NEXOS_API_KEY` pada Netlify production environment.
- Produces: deploy production yang memakai Nexos untuk impor mutasi.

- [ ] Verifikasi `NEXOS_API_KEY` tersedia tanpa mencetak nilainya.
- [ ] Jalankan seluruh test dan syntax check dari kondisi bersih.
- [ ] Commit dan push perubahan ke branch yang terhubung ke Netlify.
- [ ] Tunggu deploy selesai, cek status deploy, lalu smoke-test endpoint live dengan payload CSV kecil.
