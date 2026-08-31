// Daftar semua halaman yang bisa diberi izin akses secara terpisah.
// "key" harus sama persis dengan nama folder halaman di app/ (dipakai di URL).
export const ACCESS_PAGES = [
  { key: "ringkasan", label: "Dashboard" },
  { key: "kasir", label: "Kasir" },
  { key: "produk", label: "Master Produk" },
  { key: "stok-barang", label: "Stok Barang" },
  { key: "restok", label: "Stok Masuk" },
  { key: "penjualan", label: "Stok Keluar / Penjualan" },
  { key: "supplier", label: "Supplier" },
  { key: "laporan", label: "Laporan" },
  { key: "pengaturan", label: "Pengaturan" },
];

// allowedPages === null/undefined artinya PEMILIK (akses penuh, tanpa batasan).
// allowedPages berupa array artinya akun terbatas, cuma boleh akses yang ada di daftar itu.
export function hasAccess(allowedPages, pageKey) {
  if (!Array.isArray(allowedPages)) return true; // pemilik / akun lama tanpa batasan
  return allowedPages.includes(pageKey);
}
