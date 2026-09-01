"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonTableRows, SkeletonStatRow } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/client";
import {
  CSV_URLS,
  fetchCsvRows,
  findHeaderRow,
  guessCategory,
  computeStatus,
  fetchSettings,
  DEFAULT_STOK_MIN,
} from "@/lib/dashboardUtils";

export default function StokBarangPage() {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);
  const [stokMin, setStokMin] = useState(DEFAULT_STOK_MIN);
  const supabase = createClient();

  async function loadData() {
    try {
      const settings = await fetchSettings(supabase);
      const minStok = settings?.stok_minimum ?? DEFAULT_STOK_MIN;
      setStokMin(minStok);

      const rows = await fetchCsvRows(CSV_URLS.stok);
      const headerIdx = findHeaderRow(rows, ["kode barang", "nama barang"]);
      if (headerIdx === -1) throw new Error("Kolom tidak ditemukan");

      const header = rows[headerIdx].map((c) => (c || "").toString().trim().toLowerCase());
      const idxNama = header.indexOf("nama barang");
      const idxSatuan = header.indexOf("satuan");
      const idxTotal = header.indexOf("total akhir");

      const data = rows
        .slice(headerIdx + 1)
        .map((r) => {
          const nama = (r[idxNama] || "").toString().trim();
          const satuan = (r[idxSatuan] || "").toString().trim();
          const stok = idxTotal > -1 ? (r[idxTotal] || "0").toString().trim() : "0";
          return {
            nama,
            kategori: guessCategory(nama),
            stok,
            satuan,
            status: computeStatus(stok, minStok),
          };
        })
        .filter((p) => p.nama);

      setStockData(data);
      setLastSync("Diperbarui: " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat stok:", err);
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

  const filtered = stockData
    .filter((p) => !search || p.nama.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => filterStatus === "all" || p.status === filterStatus)
    .sort((a, b) => {
      const order = { habis: 0, menipis: 1, aman: 2 };
      return order[a.status] - order[b.status];
    });

  const aman = stockData.filter((p) => p.status === "aman").length;
  const menipis = stockData.filter((p) => p.status === "menipis").length;
  const habis = stockData.filter((p) => p.status === "habis").length;

  return (
    <DashboardLayout
      title="Stok Barang"
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
        <SkeletonStatRow count={4} />
      ) : (
        <div className="stat-row">
          <div className="stat-cell">
            <div className="lbl">Total Produk</div>
            <div className="val">{stockData.length || "–"}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Stok Aman</div>
            <div className="val" style={{ color: "var(--sage)" }}>{aman}</div>
          </div>
          <div className="stat-cell warn">
            <div className="lbl">Stok Menipis</div>
            <div className="val">{menipis}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Stok Habis</div>
            <div className="val" style={{ color: "var(--rust)" }}>{habis}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Daftar Stok Produk</h3>
          <div className="panel-controls">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input type="text" placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Semua Status</option>
              <option value="aman">Stok Aman</option>
              <option value="menipis">Stok Menipis</option>
              <option value="habis">Stok Habis</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Stok</th>
                <th>Satuan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={5} rows={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="empty-row">Tidak ada produk yang cocok.</td></tr>
              )}
              {!loading &&
                filtered.map((p, i) => (
                  <tr key={i}>
                    <td className="prod-name">{p.nama}</td>
                    <td>{p.kategori}</td>
                    <td className="stok-val">{p.stok}</td>
                    <td>{p.satuan || "-"}</td>
                    <td>
                      <span className={`status-badge status-${p.status}`}>
                        {p.status === "aman" ? "✓ Aman" : p.status === "menipis" ? "⚠ Menipis" : "✕ Habis"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
