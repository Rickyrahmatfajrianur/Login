-- ============================================================
-- TAMBAHAN — Kolom Harga Grosir
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- ============================================================

alter table products add column if not exists wholesale_price numeric;

-- ============================================================
-- Selesai! Kolom "Harga Grosir" siap dipakai di Master Produk.
-- ============================================================
