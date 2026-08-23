-- ============================================================
-- SKEMA DATABASE — Taniku Agro Admin
-- Jalankan file ini di Supabase: buka project kamu → SQL Editor
-- → New Query → paste semua isi file ini → klik Run
-- ============================================================

-- 1. Tabel utama produk
create table if not exists products (
  id text primary key,
  name text not null,
  cat text not null,
  size text,
  img text,
  description text,
  active_ingredient text,
  target text,
  long_desc text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Aktifkan Row Level Security (WAJIB — ini yang menjaga keamanan data)
alter table products enable row level security;

-- 3. Kebijakan: SIAPA SAJA boleh MEMBACA data produk (dibutuhkan website utama)
create policy "Publik boleh membaca produk"
  on products for select
  using (true);

-- 4. Kebijakan: HANYA pengguna yang sudah login yang boleh
--    menambah, mengubah, atau menghapus produk
create policy "Hanya admin login yang boleh menambah"
  on products for insert
  to authenticated
  with check (true);

create policy "Hanya admin login yang boleh mengubah"
  on products for update
  to authenticated
  using (true);

create policy "Hanya admin login yang boleh menghapus"
  on products for delete
  to authenticated
  using (true);

-- 5. Otomatis update kolom "updated_at" setiap kali data diubah
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on products
  for each row
  execute function update_updated_at();

-- ============================================================
-- Selesai! Setelah ini jalan tanpa error, tabel "products" siap dipakai.
-- Langkah berikutnya: import 95 produk yang sudah ada (lihat file terpisah).
-- ============================================================
