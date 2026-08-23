-- ============================================================
-- SKEMA DATABASE — Tabel Pengaturan (Settings)
-- Jalankan di Supabase: SQL Editor > New Query > paste > Run
-- ============================================================

create table if not exists settings (
  id int primary key default 1,
  nama_toko text,
  alamat text,
  jam_operasional text,
  whatsapp text,
  metode_pembayaran text,
  stok_minimum int default 5,
  updated_at timestamptz default now()
);

-- Isi baris pertama dengan data yang sudah ada (kalau belum ada, tambahkan)
insert into settings (id, nama_toko, alamat, jam_operasional, whatsapp, metode_pembayaran, stok_minimum)
values (
  1,
  'Taniku Agro',
  'Desa Rintik RT.003, Kec. Babulu, Penajam Paser Utara, Kalimantan Timur',
  '06.00 – 21.00 WITA (Setiap hari)',
  '0851-5721-5526',
  'Tunai · Transfer · QRIS',
  5
)
on conflict (id) do nothing;

-- Aktifkan Row Level Security
alter table settings enable row level security;

-- Siapa saja boleh MEMBACA pengaturan (dibutuhkan Stok Barang & Ringkasan)
create policy "Publik boleh membaca pengaturan"
  on settings for select
  using (true);

-- Hanya yang LOGIN boleh MENGUBAH pengaturan
create policy "Admin boleh update pengaturan"
  on settings for update
  to authenticated
  using (true);

-- Otomatis update kolom updated_at
create or replace function update_settings_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_settings_updated_at
  before update on settings
  for each row
  execute function update_settings_timestamp();

-- ============================================================
-- Selesai! Tabel "settings" siap dipakai.
-- ============================================================
