-- ============================================================
-- KEBIJAKAN AKSES — Bucket "product-images"
-- Jalankan SETELAH bucket "product-images" dibuat secara manual
-- lewat Storage > New bucket (centang "Public bucket")
-- ============================================================

-- 1. Siapa saja boleh MELIHAT foto (dibutuhkan pelanggan di website)
create policy "Publik boleh melihat foto produk"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- 2. Hanya yang sudah LOGIN boleh UPLOAD foto baru
create policy "Admin boleh upload foto"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- 3. Hanya yang sudah LOGIN boleh HAPUS/GANTI foto
create policy "Admin boleh hapus foto"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

create policy "Admin boleh update foto"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

-- ============================================================
-- Selesai! Setelah ini jalan tanpa error, bucket siap dipakai upload.
-- ============================================================
