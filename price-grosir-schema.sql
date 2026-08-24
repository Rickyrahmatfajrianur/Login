-- ============================================================
-- TAMBAHAN — Kolom Harga Grosir
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- ============================================================

alter table products add column if not exists price_grosir numeric;

-- ============================================================
-- Selesai! Kolom "Harga Grosir" siap diisi lewat Master Produk.
-- ============================================================
