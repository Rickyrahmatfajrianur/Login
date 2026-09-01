"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonStatRow, SkeletonTableRows } from "@/components/Skeleton";
import { CSV_URLS, fetchCsvRows, findHeaderRow, formatRupiah, formatTanggal, parseAngkaIndonesia } from "@/lib/dashboardUtils";

export default function PenjualanPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const rows = await fetchCsvRows(CSV_URLS.penjualan);
      const headerIdx = findHeaderRow(rows, ["tanggal", "nama barang", "gross profit"]);
      if (headerIdx === -1) throw new Error("Kolom tidak ditemukan");

      const h = rows[headerIdx].map((c) => (c || "").toString().trim().toLowerCase());
      const idxTgl = h.indexOf("tanggal");
      const idxCustomer = h.indexOf("nama customer");
      const idxNama = h.indexOf("nama barang");
      const idxStatus = h.indexOf("status");
      const idxBanyak = h.indexOf("banyak barang");
      const idxProfit = h.indexOf("gross profit");
      const idxHargaAkhir = h.indexOf("harga akhir");

      const list = rows
        .slice(headerIdx + 1)
        .map((r) => ({
          tanggal: (r[idxTgl] || "").toString().trim(),
          customer: (r[idxCustomer] || "").toString().trim(),
          nama: (r[idxNama] || "").toString().trim(),
          status: (r[idxStatus] || "").toString().trim(),
          banyak: (r[idxBanyak] || "0").toString().trim(),
          profit: parseAngkaIndonesia(r[idxProfit]),
          hargaAkhir: parseAngkaIndonesia(r[idxHargaAkhir]),
        }))
        .filter((p) => p.nama);

      setData(list);
      setLastSync("Diperbarui: " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat penjualan:", err);
      setLastSync("Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 400);
  }

  const filtered = data.filter(
    (p) =>
      !search ||
      p.nama.toLowerCase().includes(search.toLowerCase()) ||
      p.customer.toLowerCase().includes(search.toLowerCase())
  );
  const totalNilai = data.reduce((s, p) => s + p.hargaAkhir, 0);
  const totalProfit = data.reduce((s, p) => s + p.profit, 0);

  return (
    <DashboardLayout
      title="Stok Keluar / Penjualan"
      headerRight={
        <>
          <span className="last-sync">{lastSync}</span>
          <button className={`btn-refresh ${refreshing ? "spinning" : ""}`} onClick={handleRefresh}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Refresh
          </button>
        </>
      }
    >
      {loading ? (
        <SkeletonStatRow count={3} />
      ) : (
        <div className="stat-row">
          <div className="stat-cell">
            <div className="lbl">Total Transaksi</div>
            <div className="val">{data.length || "–"}</div>
          </div>
          <div className="stat-cell accent">
            <div className="lbl">Total Penjualan</div>
            <div className="val small">{formatRupiah(totalNilai)}</div>
          </div>
          <div className="stat-cell profit">
            <div className="lbl">Total Profit</div>
            <div className="val small">{formatRupiah(totalProfit)}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Riwayat Penjualan</h3>
          <div className="panel-controls">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input type="text" placeholder="Cari produk / customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th><th>Produk</th><th>Customer</th><th>Jumlah</th>
                <th>Harga Akhir</th><th>Profit</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={7} rows={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="empty-row">Belum ada transaksi penjualan yang tercatat.</td></tr>
              )}
              {!loading &&
                filtered.slice().reverse().map((p, i) => (
                  <tr key={i}>
                    <td>{formatTanggal(p.tanggal)}</td>
                    <td className="prod-name">{p.nama}</td>
                    <td>{p.customer || "-"}</td>
                    <td className="stok-val">{p.banyak}</td>
                    <td className="stok-val">{formatRupiah(p.hargaAkhir)}</td>
                    <td className="stok-val">{formatRupiah(p.profit)}</td>
                    <td>{p.status || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
