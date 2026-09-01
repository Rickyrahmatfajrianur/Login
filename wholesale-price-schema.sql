-- ============================================================
-- ⚠️ SUDAH TIDAK DIPAKAI — digantikan oleh price-grosir-schema.sql
-- ============================================================
-- File ini dulu menambahkan kolom "wholesale_price", tapi Master Produk
-- di aplikasi (app/produk/page.js) ternyata pakai nama kolom "price_grosir"
-- (lihat price-grosir-schema.sql). Kalau file ini pernah dijalankan di
-- Supabase, kolom "wholesale_price" akan tetap ada tapi nggak pernah dibaca
-- atau diisi oleh aplikasi — jangan bingung kalau nemu kolom ini kosong.
--
-- JANGAN jalankan file ini lagi. Kalau mau pakai fitur Harga Grosir,
-- cukup jalankan price-grosir-schema.sql. Kolom "wholesale_price" yang
-- sudah terlanjur ada boleh dibiarkan atau dihapus manual kalau memang
-- tidak ada datanya:
--   alter table products drop column if exists wholesale_price;
-- ============================================================

alter table products add column if not exists wholesale_price numeric;

-- ============================================================
-- Selesai! Kolom "Harga Grosir" siap dipakai di Master Produk.
-- ============================================================
