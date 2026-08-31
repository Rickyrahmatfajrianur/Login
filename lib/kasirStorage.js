// Penyimpanan lokal khusus Kasir — offline-first, sinkron ke Google Apps Script.
// Aman dipanggil di client component saja (localStorage tidak ada di server).

export function getKasirProducts() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("kasir_produk") || "[]");
  } catch {
    return [];
  }
}
export function saveKasirProducts(list) {
  if (typeof window === "undefined") return;
  localStorage.setItem("kasir_produk", JSON.stringify(list));
}

export function getKasirTransactions() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("kasir_transaksi") || "[]");
  } catch {
    return [];
  }
}
export function saveKasirTransactions(list) {
  if (typeof window === "undefined") return;
  localStorage.setItem("kasir_transaksi", JSON.stringify(list));
}

export function formatRupiahKasir(v) {
  return "Rp" + Math.round(v || 0).toLocaleString("id-ID");
}
export function formatAngkaKasir(v) {
  return Number.isInteger(v) ? String(v) : (v || 0).toFixed(1);
}
export function slugIdKasir(nama) {
  return "p_" + nama.replace(/[^a-zA-Z0-9]/g, "_");
}
