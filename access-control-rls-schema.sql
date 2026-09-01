-- ============================================================
-- TAMBAHAN — Tegakkan Izin Akses per Halaman di Level Database (RLS)
-- ============================================================
-- MASALAH: kebijakan RLS sebelumnya untuk "products", "settings", dan
-- storage bucket "product-images" cuma mengecek "sudah login"
-- (to authenticated), TANPA mengecek app_metadata.allowed_pages.
-- Akibatnya, karyawan yang izinnya dibatasi (misal cuma boleh akses
-- halaman Kasir) sebenarnya tetap bisa mengubah/menghapus produk atau
-- ubah Pengaturan lewat panggilan langsung ke Supabase (mis. lewat
-- console browser) — soalnya pembatasan sebelumnya cuma ada di level
-- UI/middleware routing, bukan di level database.
--
-- File ini menambahkan pengecekan allowed_pages langsung di kebijakan
-- RLS, jadi biarpun seseorang coba akses Supabase-nya langsung, dia
-- tetap kebentur izin yang sama seperti di aplikasi.
--
-- Jalankan di Supabase: SQL Editor > New Query > paste semua isi file
-- ini > klik Run. Aman dijalankan berkali-kali (idempotent).
-- ============================================================

-- Fungsi bantuan: cek apakah akun yang sedang login boleh akses halaman
-- tertentu. Pemilik (allowed_pages null/tidak ada di app_metadata) =
-- akses penuh, sama seperti logic hasAccess() di lib/permissions.js.
create or replace function has_page_access(page_key text)
returns boolean
language sql
stable
as $$
  select
    (auth.jwt() -> 'app_metadata' -> 'allowed_pages') is null
    or (auth.jwt() -> 'app_metadata' -> 'allowed_pages') @> to_jsonb(page_key);
$$;

-- ===== Tabel "products" — ubah/tambah/hapus butuh akses halaman "produk" =====
drop policy if exists "Hanya admin login yang boleh menambah" on products;
drop policy if exists "Hanya admin login yang boleh mengubah" on products;
drop policy if exists "Hanya admin login yang boleh menghapus" on products;

create policy "Hanya akun dengan akses Master Produk yang boleh menambah"
  on products for insert
  to authenticated
  with check (has_page_access('produk'));

create policy "Hanya akun dengan akses Master Produk yang boleh mengubah"
  on products for update
  to authenticated
  using (has_page_access('produk'))
  with check (has_page_access('produk'));

create policy "Hanya akun dengan akses Master Produk yang boleh menghapus"
  on products for delete
  to authenticated
  using (has_page_access('produk'));

-- ===== Tabel "settings" — update butuh akses halaman "pengaturan" =====
drop policy if exists "Admin boleh update pengaturan" on settings;

create policy "Hanya akun dengan akses Pengaturan yang boleh update"
  on settings for update
  to authenticated
  using (has_page_access('pengaturan'))
  with check (has_page_access('pengaturan'));

-- ===== Storage bucket "product-images" — butuh akses halaman "produk" =====
drop policy if exists "Admin boleh upload foto" on storage.objects;
drop policy if exists "Admin boleh hapus foto" on storage.objects;
drop policy if exists "Admin boleh update foto" on storage.objects;

create policy "Hanya akun dengan akses Master Produk yang boleh upload foto"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and has_page_access('produk'));

create policy "Hanya akun dengan akses Master Produk yang boleh hapus foto"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and has_page_access('produk'));

create policy "Hanya akun dengan akses Master Produk yang boleh update foto"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and has_page_access('produk'));

-- ============================================================
-- PENTING: kebijakan di atas mengecek app_metadata dari TOKEN (JWT) akun
-- yang sedang login, bukan langsung dari database secara real-time.
-- Kalau kamu baru saja mengubah allowed_pages seorang karyawan lewat
-- halaman Pengaturan, dia perlu login ulang (atau tunggu token-nya
-- di-refresh otomatis oleh Supabase) supaya token barunya membawa
-- allowed_pages yang terbaru.
--
-- Akun Pemilik (yang tidak pernah diberi allowed_pages, jadi nilainya
-- null) tidak terpengaruh sama sekali — tetap akses penuh seperti biasa.
-- ============================================================
