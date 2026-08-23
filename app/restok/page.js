"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { CSV_URLS, fetchCsvRows, findHeaderRow, formatRupiah, formatTanggal } from "@/lib/dashboardUtils";

export default function RestokPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const rows = await fetchCsvRows(CSV_URLS.restok);
      const headerIdx = findHeaderRow(rows, ["tanggal", "nama barang", "distributor"]);
      if (headerIdx === -1) throw new Error("Kolom tidak ditemukan");

      const h = rows[headerIdx].map((c) => (c || "").toString().trim().toLowerCase());
      const idxTgl = h.indexOf("tanggal");
      const idxNoNota = h.indexOf("no nota");
      const idxDist = h.indexOf("distributor");
      const idxNama = h.indexOf("nama barang");
      const idxBanyak = h.indexOf("banyak barang");
      const idxHarga = h.indexOf("harga beli/pcs");
      const idxTotal = h.indexOf("total");
      const idxStatus = h.indexOf("status");

      const list = rows
        .slice(headerIdx + 1)
        .map((r) => ({
          tanggal: (r[idxTgl] || "").toString().trim(),
          noNota: (r[idxNoNota] || "").toString().trim(),
          distributor: (r[idxDist] || "").toString().trim(),
          nama: (r[idxNama] || "").toString().trim(),
          banyak: (r[idxBanyak] || "0").toString().trim(),
          harga: (r[idxHarga] || "").toString().trim(),
          total: parseFloat((r[idxTotal] || "").toString().replace(/[^0-9.-]/g, "")) || 0,
          status: (r[idxStatus] || "").toString().trim(),
        }))
        .filter((p) => p.nama);

      setData(list);
      setLastSync("Diperbarui: " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat restok:", err);
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
      p.distributor.toLowerCase().includes(search.toLowerCase())
  );
  const totalNilai = data.reduce((s, p) => s + p.total, 0);
  const terakhir = data.length ? formatTanggal(data[data.length - 1].tanggal, true) : "-";

  return (
    <DashboardLayout
      title="Stok Masuk"
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
      <div className="stats-row">
        <div className="stat-card">
          <div className="ic-circle ic-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </div>
          <div className="lbl">Total Transaksi</div>
          <div className="val">{data.length || "–"}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </div>
          <div className="lbl">Total Barang Masuk</div>
          <div className="val">{data.reduce((s, p) => s + (parseFloat(p.banyak) || 0), 0)}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="lbl">Total Nilai Pembelian</div>
          <div className="val" style={{ fontSize: 18 }}>{formatRupiah(totalNilai)}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="lbl">Restok Terakhir</div>
          <div className="val" style={{ fontSize: 16 }}>{terakhir}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Riwayat Restok Barang</h3>
          <div className="panel-controls">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input type="text" placeholder="Cari produk atau distributor..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th><th>No Nota</th><th>Distributor</th><th>Nama Barang</th>
                <th>Banyak</th><th>Harga Beli</th><th>Total</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="loading-row">Memuat data...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="empty-row">Belum ada transaksi restok yang tercatat.</td></tr>
              )}
              {!loading &&
                filtered.slice().reverse().map((p, i) => (
                  <tr key={i}>
                    <td>{formatTanggal(p.tanggal)}</td>
                    <td>{p.noNota || "-"}</td>
                    <td>{p.distributor || "-"}</td>
                    <td className="prod-name">{p.nama}</td>
                    <td className="stok-val">{p.banyak || "0"}</td>
                    <td className="stok-val">{p.harga || "-"}</td>
                    <td className="stok-val">{formatRupiah(p.total)}</td>
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
