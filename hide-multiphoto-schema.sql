-- ============================================================
-- TAMBAHAN — Hide Produk & Multi Foto (maks 3)
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- ============================================================

alter table products add column if not exists is_hidden boolean default false;
alter table products add column if not exists img2 text;
alter table products add column if not exists img3 text;

-- ============================================================
-- Selesai! "img" tetap jadi foto utama, img2 & img3 foto tambahan (opsional).
-- ============================================================
