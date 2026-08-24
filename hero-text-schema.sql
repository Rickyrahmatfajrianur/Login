-- ============================================================
-- TAMBAHAN — Kolom Teks Hero Beranda (judul & deskripsi)
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- ============================================================

alter table settings add column if not exists hero_heading text;
alter table settings add column if not exists hero_lede text;

-- Isi dengan teks yang sekarang aktif di website (biar nggak kosong pas pertama kali)
update settings
set
  hero_heading = coalesce(hero_heading, 'Sarana Pertanian Terlengkap, dari Taniku Agro untuk petani'),
  hero_lede = coalesce(hero_lede, 'Herbisida, fungisida, insektisida, dan kebutuhan tani lainnya. Cari produk, masukkan keranjang, checkout langsung ke WhatsApp kami.')
where id = 1;

-- ============================================================
-- Selesai! Sekarang bisa diedit lewat halaman Pengaturan.
-- ============================================================
