-- ============================================================
-- TAMBAHAN — Target Bulanan (buat progress bar "Target Bulan Ini" di Dashboard)
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

alter table settings add column if not exists target_penjualan_bulanan numeric default 150000000;
alter table settings add column if not exists target_laba_bulanan numeric default 10000000;

-- Isi nilai awal sesuai yang diminta (Rp150.000.000 penjualan, Rp10.000.000 laba kotor).
-- Kalau kolomnya sudah ada isinya sebelumnya, baris ini nggak akan menimpa (hanya isi yang masih kosong).
update settings
set
  target_penjualan_bulanan = coalesce(target_penjualan_bulanan, 150000000),
  target_laba_bulanan = coalesce(target_laba_bulanan, 10000000)
where id = 1;

-- ============================================================
-- Selesai! Angka target ini bisa diubah kapan saja lewat halaman Pengaturan
-- di aplikasi (nggak perlu jalanin SQL lagi tiap bulan).
-- ============================================================
