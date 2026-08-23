"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CSV_URLS,
  fetchCsvRows,
  findHeaderRow,
  computeStatus,
  formatRupiahShort,
  formatTanggal,
} from "@/lib/dashboardUtils";

export default function RingkasanPage() {
  const [stats, setStats] = useState({
    totalProduk: 0, aman: 0, menipis: 0, habis: 0,
    totalRestok: 0, totalPenjualan: 0, nilaiBeli: 0, nilaiJual: 0,
  });
  const [restokTerbaru, setRestokTerbaru] = useState([]);
  const [penjualanTerbaru, setPenjualanTerbaru] = useState([]);
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const [stokRows, restokRows, penjualanRows] = await Promise.all([
        fetchCsvRows(CSV_URLS.stok),
        fetchCsvRows(CSV_URLS.restok),
        fetchCsvRows(CSV_URLS.penjualan),
      ]);

      // Stok
      const stokIdx = findHeaderRow(stokRows, ["kode barang", "nama barang"]);
      let aman = 0, menipis = 0, habis = 0, totalProduk = 0;
      if (stokIdx > -1) {
        const h = stokRows[stokIdx].map((c) => (c || "").toString().trim().toLowerCase());
        const idxNama = h.indexOf("nama barang");
        const idxTotal = h.indexOf("total akhir");
        const produkList = stokRows.slice(stokIdx + 1)
          .map((r) => ({ nama: (r[idxNama] || "").toString().trim(), stok: idxTotal > -1 ? (r[idxTotal] || "0").toString().trim() : "0" }))
          .filter((p) => p.nama)
          .map((p) => ({ ...p, status: computeStatus(p.stok, 5) }));
        totalProduk = produkList.length;
        aman = produkList.filter((p) => p.status === "aman").length;
        menipis = produkList.filter((p) => p.status === "menipis").length;
        habis = produkList.filter((p) => p.status === "habis").length;
      }

      // Restok
      const restokIdx = findHeaderRow(restokRows, ["tanggal", "nama barang", "distributor"]);
      let restokList = [];
      if (restokIdx > -1) {
        const h = restokRows[restokIdx].map((c) => (c || "").toString().trim().toLowerCase());
        const idxTgl = h.indexOf("tanggal");
        const idxDist = h.indexOf("distributor");
        const idxNama = h.indexOf("nama barang");
        const idxTotal = h.indexOf("total");
        restokList = restokRows.slice(restokIdx + 1)
          .map((r) => ({
            tanggal: (r[idxTgl] || "").toString().trim(),
            distributor: (r[idxDist] || "").toString().trim(),
            nama: (r[idxNama] || "").toString().trim(),
            total: parseFloat((r[idxTotal] || "").toString().replace(/[^0-9.-]/g, "")) || 0,
          }))
          .filter((p) => p.nama);
      }

      // Penjualan
      const penjualanIdx = findHeaderRow(penjualanRows, ["tanggal", "nama barang", "gross profit"]);
      let penjualanList = [];
      if (penjualanIdx > -1) {
        const h = penjualanRows[penjualanIdx].map((c) => (c || "").toString().trim().toLowerCase());
        const idxTgl = h.indexOf("tanggal");
        const idxCustomer = h.indexOf("nama customer");
        const idxNama = h.indexOf("nama barang");
        const idxHargaAkhir = h.indexOf("harga akhir");
        penjualanList = penjualanRows.slice(penjualanIdx + 1)
          .map((r) => ({
            tanggal: (r[idxTgl] || "").toString().trim(),
            customer: (r[idxCustomer] || "").toString().trim(),
            nama: (r[idxNama] || "").toString().trim(),
            hargaAkhir: parseFloat((r[idxHargaAkhir] || "").toString().replace(/[^0-9.-]/g, "")) || 0,
          }))
          .filter((p) => p.nama);
      }

      setStats({
        totalProduk, aman, menipis, habis,
        totalRestok: restokList.length,
        totalPenjualan: penjualanList.length,
        nilaiBeli: restokList.reduce((s, p) => s + p.total, 0),
        nilaiJual: penjualanList.reduce((s, p) => s + p.hargaAkhir, 0),
      });
      setRestokTerbaru(restokList.slice(-5).reverse());
      setPenjualanTerbaru(penjualanList.slice(-5).reverse());
      setLastSync("Diperbarui: " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat ringkasan:", err);
      setLastSync("Gagal memuat");
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

  const total = stats.aman + stats.menipis + stats.habis;
  const circumference = 2 * Math.PI * 58;
  let offset = 0;
  const segments = [
    { value: stats.aman, color: "#1F8A4C" },
    { value: stats.menipis, color: "#C88719" },
    { value: stats.habis, color: "#C53030" },
  ];

  return (
    <DashboardLayout
      title="Dashboard"
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
          <div className="ic-circle ic-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /></svg></div>
          <div className="lbl">Total Produk</div>
          <div className="val">{stats.totalProduk || "–"}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></div>
          <div className="lbl">Perlu Perhatian</div>
          <div className="val">{stats.menipis + stats.habis}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg></div>
          <div className="lbl">Transaksi Restok</div>
          <div className="val">{stats.totalRestok}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></div>
          <div className="lbl">Transaksi Penjualan</div>
          <div className="val">{stats.totalPenjualan}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
          <div className="lbl">Nilai Pembelian</div>
          <div className="val" style={{ fontSize: 16 }}>{formatRupiahShort(stats.nilaiBeli)}</div>
        </div>
        <div className="stat-card">
          <div className="ic-circle ic-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
          <div className="lbl">Nilai Penjualan</div>
          <div className="val" style={{ fontSize: 16 }}>{formatRupiahShort(stats.nilaiJual)}</div>
        </div>
      </div>

      <div className="panels-row-ringkasan">
        <div className="panel">
          <div className="panel-head"><h3>Ringkasan Status Stok</h3></div>
          <div className="donut-wrap">
            <div className="donut">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="58" fill="none" stroke="#EEF2F5" strokeWidth="16" />
                {total > 0 &&
                  segments.map((seg, i) => {
                    if (seg.value === 0) return null;
                    const fraction = seg.value / total;
                    const dash = fraction * circumference;
                    const el = (
                      <circle
                        key={i}
                        cx="70" cy="70" r="58" fill="none"
                        stroke={seg.color} strokeWidth="16"
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 70 70)"
                      />
                    );
                    offset += dash;
                    return el;
                  })}
              </svg>
              <div className="donut-center">
                <b>{stats.totalProduk || "–"}</b>
                <span>Total Produk</span>
              </div>
            </div>
            <div className="donut-legend">
              <div className="item"><span className="dot" style={{ background: "#1F8A4C" }}></span> Stok Aman <b>{stats.aman}</b></div>
              <div className="item"><span className="dot" style={{ background: "#C88719" }}></span> Stok Menipis <b>{stats.menipis}</b></div>
              <div className="item"><span className="dot" style={{ background: "#C53030" }}></span> Stok Habis <b>{stats.habis}</b></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Restok Terbaru</h3><Link href="/restok" className="see-all-link">Lihat semua →</Link></div>
          <div className="mini-list">
            {restokTerbaru.length === 0 && <div className="empty-row">Belum ada transaksi restok.</div>}
            {restokTerbaru.map((r, i) => (
              <div className="mini-item" key={i}>
                <div className="mi-main">
                  <div className="mi-name">{r.nama}</div>
                  <div className="mi-sub">{r.distributor || "-"} · {formatTanggal(r.tanggal, true)}</div>
                </div>
                <div className="mi-val">{formatRupiahShort(r.total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Penjualan Terbaru</h3><Link href="/penjualan" className="see-all-link">Lihat semua →</Link></div>
          <div className="mini-list">
            {penjualanTerbaru.length === 0 && <div className="empty-row">Belum ada transaksi penjualan.</div>}
            {penjualanTerbaru.map((p, i) => (
              <div className="mini-item" key={i}>
                <div className="mi-main">
                  <div className="mi-name">{p.nama}</div>
                  <div className="mi-sub">{p.customer || "-"} · {formatTanggal(p.tanggal, true)}</div>
                </div>
                <div className="mi-val">{formatRupiahShort(p.hargaAkhir)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
