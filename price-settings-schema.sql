-- ============================================================
-- TAMBAHAN — Kolom Harga Produk & Toggle Tampilan Harga
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- ============================================================

-- 1. Tambah kolom harga di tabel produk (kalau belum ada)
alter table products add column if not exists price numeric;

-- 2. Tambah kolom pengaturan: apakah harga asli ditampilkan di website
alter table settings add column if not exists show_real_price boolean default false;

-- ============================================================
-- Selesai! Sekarang tinggal isi harga tiap produk lewat Master Produk,
-- dan atur toggle-nya lewat halaman Pengaturan.
-- ============================================================
