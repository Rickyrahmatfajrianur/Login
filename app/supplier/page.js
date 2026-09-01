"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonStatRow, SkeletonTableRows } from "@/components/Skeleton";
import { CSV_URLS, fetchCsvRows, findHeaderRow, formatRupiah, formatTanggal, parseTanggalToDate, parseAngkaIndonesia } from "@/lib/dashboardUtils";

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [totalTransaksi, setTotalTransaksi] = useState(0);
  const [totalNilai, setTotalNilai] = useState(0);
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
      const idxDist = h.indexOf("distributor");
      const idxNama = h.indexOf("nama barang");
      const idxBanyak = h.indexOf("banyak barang");
      const idxTotal = h.indexOf("total");

      const transaksi = rows
        .slice(headerIdx + 1)
        .map((r) => ({
          tanggal: (r[idxTgl] || "").toString().trim(),
          distributor: (r[idxDist] || "").toString().trim(),
          nama: (r[idxNama] || "").toString().trim(),
          banyak: parseFloat(r[idxBanyak]) || 0,
          total: parseAngkaIndonesia(r[idxTotal]),
        }))
        .filter((p) => p.nama && p.distributor);

      const grouped = {};
      transaksi.forEach((t) => {
        if (!grouped[t.distributor]) {
          grouped[t.distributor] = { nama: t.distributor, jumlahTransaksi: 0, totalBarang: 0, totalNilai: 0, terakhirRaw: null, terakhirDate: null };
        }
        const g = grouped[t.distributor];
        g.jumlahTransaksi += 1;
        g.totalBarang += t.banyak;
        g.totalNilai += t.total;
        const tgl = parseTanggalToDate(t.tanggal);
        if (tgl && (!g.terakhirDate || tgl > g.terakhirDate)) {
          g.terakhirDate = tgl;
          g.terakhirRaw = t.tanggal;
        }
      });

      setSuppliers(Object.values(grouped));
      setTotalTransaksi(transaksi.length);
      setTotalNilai(transaksi.reduce((s, t) => s + t.total, 0));
      setLastSync("Diperbarui: " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat supplier:", err);
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

  const filtered = suppliers
    .filter((s) => !search || s.nama.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.jumlahTransaksi - a.jumlahTransaksi);

  return (
    <DashboardLayout
      title="Supplier"
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
            <div className="lbl">Total Supplier</div>
            <div className="val">{suppliers.length || "–"}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Total Transaksi</div>
            <div className="val">{totalTransaksi}</div>
          </div>
          <div className="stat-cell accent">
            <div className="lbl">Total Nilai Pembelian</div>
            <div className="val small">{formatRupiah(totalNilai)}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Daftar Supplier</h3>
          <div className="panel-controls">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input type="text" placeholder="Cari nama supplier..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Supplier</th><th>Jumlah Transaksi</th><th>Total Barang Dibeli</th>
                <th>Total Nilai Pembelian</th><th>Transaksi Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={5} rows={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="empty-row">Belum ada data supplier yang tercatat.</td></tr>
              )}
              {!loading &&
                filtered.map((s, i) => (
                  <tr key={i}>
                    <td className="prod-name">{s.nama}</td>
                    <td className="stok-val">{s.jumlahTransaksi}</td>
                    <td className="stok-val">{s.totalBarang}</td>
                    <td className="stok-val">{formatRupiah(s.totalNilai)}</td>
                    <td>{formatTanggal(s.terakhirRaw)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
