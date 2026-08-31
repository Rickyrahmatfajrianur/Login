-- ============================================================
-- TAMBAHAN — Pengaturan Sinkronisasi Kasir
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- ============================================================

alter table settings add column if not exists kasir_script_url text;
alter table settings add column if not exists kasir_script_key text;

-- ============================================================
-- Selesai! Isi lewat halaman Pengaturan setelah aplikasi ter-deploy.
-- ============================================================
