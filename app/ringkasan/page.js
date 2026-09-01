"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonStatRow } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import {
  CSV_URLS,
  fetchCsvRows,
  findHeaderRow,
  computeStatus,
  guessCategory,
  formatRupiahShort,
  formatRupiahPenuh,
  formatRupiah,
  formatTanggal,
  parseTanggalToDate,
  fetchSettings,
  DEFAULT_STOK_MIN,
  parseAngkaIndonesia,
} from "@/lib/dashboardUtils";

const PIE_COLORS = ["#0B6FDB", "#4F7A5C", "#B8862E", "#3D7A7A", "#A0402C"];

function formatAxisLabel(n) {
  if (n === 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "jt";
  if (n >= 1000) return Math.round(n / 1000) + "rb";
  return String(n);
}

const PERIOD_OPTIONS = [
  { value: "bulan_ini", label: "Bulan Ini" },
  { value: "bulan_lalu", label: "Bulan Lalu" },
  { value: "3m", label: "3 Bulan" },
  { value: "6m", label: "6 Bulan" },
  { value: "12m", label: "12 Bulan" },
];

function computeTrend(penjualanList, period) {
  const now = new Date();
  let points = [];

  if (period === "bulan_ini" || period === "bulan_lalu") {
    // Tentukan bulan & tahun target (kalender, bukan hitung mundur N hari)
    let targetMonth = now.getMonth();
    let targetYear = now.getFullYear();
    if (period === "bulan_lalu") {
      targetMonth -= 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
    }
    const isBulanIni = period === "bulan_ini";
    const jumlahHari = new Date(targetYear, targetMonth + 1, 0).getDate();
    const hariTerakhir = isBulanIni ? now.getDate() : jumlahHari;

    for (let tgl = 1; tgl <= hariTerakhir; tgl++) {
      const d = new Date(targetYear, targetMonth, tgl);
      points.push({ matchDate: d.toDateString(), year: targetYear, label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), value: 0, profit: 0 });
    }
    penjualanList.forEach((p) => {
      const d = parseTanggalToDate(p.tanggal);
      if (!d) return;
      const match = points.find((pt) => pt.matchDate === d.toDateString());
      if (match) {
        match.value += p.hargaAkhir;
        match.profit += p.profit;
      }
    });
  } else {
    const numMonths = parseInt(period, 10);
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      points.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }), value: 0, profit: 0 });
    }
    penjualanList.forEach((p) => {
      const d = parseTanggalToDate(p.tanggal);
      if (!d) return;
      const match = points.find((pt) => pt.month === d.getMonth() && pt.year === d.getFullYear());
      if (match) {
        match.value += p.hargaAkhir;
        match.profit += p.profit;
      }
    });
  }

  return { points };
}

export default function RingkasanPage() {
  const [stats, setStats] = useState({
    totalProduk: 0, totalUnit: 0, aman: 0, menipis: 0, habis: 0,
    penjualanHariIni: 0, penjualanBulanIni: 0, pembelianBulanIni: 0, labaKotorBulanIni: 0,
  });
  const [restokTerbaru, setRestokTerbaru] = useState([]);
  const [penjualanTerbaru, setPenjualanTerbaru] = useState([]);
  const [perluDirestok, setPerluDirestok] = useState([]);
  const [produkTerlaris, setProdukTerlaris] = useState([]);
  const [kategoriTerlaris, setKategoriTerlaris] = useState([]);
  const [penjualanRaw, setPenjualanRaw] = useState([]);
  const [period, setPeriod] = useState("bulan_ini");
  const [showPenjualan, setShowPenjualan] = useState(true);
  const [showLaba, setShowLaba] = useState(true);
  const trend = useMemo(() => computeTrend(penjualanRaw, period), [penjualanRaw, period]);
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadData() {
    try {
      const settings = await fetchSettings(supabase);
      const minStok = settings?.stok_minimum ?? DEFAULT_STOK_MIN;

      const [stokRows, restokRows, penjualanRows] = await Promise.all([
        fetchCsvRows(CSV_URLS.stok),
        fetchCsvRows(CSV_URLS.restok),
        fetchCsvRows(CSV_URLS.penjualan),
      ]);

      const now = new Date();
      const todayStr = now.toDateString();
      const curMonth = now.getMonth();
      const curYear = now.getFullYear();

      // ===== 1. STOK =====
      const stokIdx = findHeaderRow(stokRows, ["kode barang", "nama barang"]);
      let produkList = [];
      if (stokIdx > -1) {
        const h = stokRows[stokIdx].map((c) => (c || "").toString().trim().toLowerCase());
        const idxNama = h.indexOf("nama barang");
        const idxTotal = h.indexOf("total akhir");
        produkList = stokRows.slice(stokIdx + 1)
          .map((r) => {
            const nama = (r[idxNama] || "").toString().trim();
            const stok = idxTotal > -1 ? (r[idxTotal] || "0").toString().trim() : "0";
            return { nama, stok: parseFloat(stok) || 0, status: computeStatus(stok, minStok) };
          })
          .filter((p) => p.nama);
      }
      const totalProduk = produkList.length;
      const totalUnit = produkList.reduce((s, p) => s + p.stok, 0);
      const aman = produkList.filter((p) => p.status === "aman").length;
      const menipis = produkList.filter((p) => p.status === "menipis").length;
      const habis = produkList.filter((p) => p.status === "habis").length;

      const perluDirestokList = produkList
        .filter((p) => p.status === "menipis" || p.status === "habis")
        .sort((a, b) => a.stok - b.stok)
        .slice(0, 6);

      // ===== 2. RESTOK =====
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
            total: parseAngkaIndonesia(r[idxTotal]),
          }))
          .filter((p) => p.nama);
      }
      const pembelianBulanIni = restokList
        .filter((r) => {
          const d = parseTanggalToDate(r.tanggal);
          return d && d.getMonth() === curMonth && d.getFullYear() === curYear;
        })
        .reduce((s, r) => s + r.total, 0);

      // ===== 3. PENJUALAN =====
      const penjualanIdx = findHeaderRow(penjualanRows, ["tanggal", "nama barang", "gross profit"]);
      let penjualanList = [];
      if (penjualanIdx > -1) {
        const h = penjualanRows[penjualanIdx].map((c) => (c || "").toString().trim().toLowerCase());
        const idxTgl = h.indexOf("tanggal");
        const idxCustomer = h.indexOf("nama customer");
        const idxNama = h.indexOf("nama barang");
        const idxBanyak = h.indexOf("banyak barang");
        const idxProfit = h.indexOf("gross profit");
        const idxHargaAkhir = h.indexOf("harga akhir");
        penjualanList = penjualanRows.slice(penjualanIdx + 1)
          .map((r) => ({
            tanggal: (r[idxTgl] || "").toString().trim(),
            customer: (r[idxCustomer] || "").toString().trim(),
            nama: (r[idxNama] || "").toString().trim(),
            banyak: parseFloat(r[idxBanyak]) || 0,
            profit: parseAngkaIndonesia(r[idxProfit]),
            hargaAkhir: parseAngkaIndonesia(r[idxHargaAkhir]),
          }))
          .filter((p) => p.nama);
      }

      const penjualanHariIni = penjualanList
        .filter((p) => {
          const d = parseTanggalToDate(p.tanggal);
          return d && d.toDateString() === todayStr;
        })
        .reduce((s, p) => s + p.hargaAkhir, 0);

      const penjualanBulanIniList = penjualanList.filter((p) => {
        const d = parseTanggalToDate(p.tanggal);
        return d && d.getMonth() === curMonth && d.getFullYear() === curYear;
      });
      const penjualanBulanIni = penjualanBulanIniList.reduce((s, p) => s + p.hargaAkhir, 0);
      const labaKotorBulanIni = penjualanBulanIniList.reduce((s, p) => s + p.profit, 0);

      // Produk paling laris (jumlah unit terjual, semua waktu)
      const produkTotal = {};
      penjualanList.forEach((p) => {
        produkTotal[p.nama] = (produkTotal[p.nama] || 0) + p.banyak;
      });
      const produkTerlarisList = Object.entries(produkTotal)
        .map(([nama, jumlah]) => ({ nama, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah)
        .slice(0, 5);

      // Kategori terlaris (berdasarkan nilai penjualan)
      const kategoriTotal = {};
      penjualanList.forEach((p) => {
        const cat = guessCategory(p.nama);
        kategoriTotal[cat] = (kategoriTotal[cat] || 0) + p.hargaAkhir;
      });
      const totalSemuaKategori = Object.values(kategoriTotal).reduce((s, v) => s + v, 0);
      const kategoriList = Object.entries(kategoriTotal)
        .map(([label, val]) => ({ label, val, pct: totalSemuaKategori ? Math.round((val / totalSemuaKategori) * 100) : 0 }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5);

      setPenjualanRaw(penjualanList);

      setStats({
        totalProduk, totalUnit, aman, menipis, habis,
        penjualanHariIni, penjualanBulanIni, pembelianBulanIni, labaKotorBulanIni,
      });
      setRestokTerbaru(restokList.slice(-5).reverse());
      setPenjualanTerbaru(penjualanList.slice(-5).reverse());
      setPerluDirestok(perluDirestokList);
      setProdukTerlaris(produkTerlarisList);
      setKategoriTerlaris(kategoriList);
      setLastSync("Diperbarui: " + now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat ringkasan:", err);
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

  const totalStokBucket = stats.aman + stats.menipis + stats.habis;
  const gaugeSegs = [
    { pct: totalStokBucket ? (stats.aman / totalStokBucket) * 100 : 0, color: "#4F7A5C" },
    { pct: totalStokBucket ? (stats.menipis / totalStokBucket) * 100 : 0, color: "#B8862E" },
    { pct: totalStokBucket ? (stats.habis / totalStokBucket) * 100 : 0, color: "#A0402C" },
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
      <div className="section-lbl">Ringkasan Produk</div>
      {loading ? (
        <SkeletonStatRow count={3} />
      ) : (
        <div className="stat-row">
          <div className="stat-cell">
            <div className="lbl">Total Produk</div>
            <div className="val">{stats.totalProduk || "–"}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Total Unit Stok</div>
            <div className="val">{stats.totalUnit.toLocaleString("id-ID")}</div>
          </div>
          <div className="stat-cell warn">
            <div className="lbl">Perlu Perhatian</div>
            <div className="val">{stats.menipis + stats.habis}</div>
          </div>
        </div>
      )}

      <div className="section-lbl">Ringkasan Keuangan</div>
      {loading ? (
        <SkeletonStatRow count={4} />
      ) : (
        <div className="stat-row fin">
          <div className="stat-cell accent">
            <div className="cell-top">
              <div className="lbl">Penjualan Hari Ini</div>
              <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            </div>
            <div className="val small">{formatRupiah(stats.penjualanHariIni)}</div>
          </div>
          <div className="stat-cell accent">
            <div className="cell-top">
              <div className="lbl">Penjualan Bulan Ini</div>
              <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div className="val small">{formatRupiah(stats.penjualanBulanIni)}</div>
          </div>
          <div className="stat-cell">
            <div className="cell-top">
              <div className="lbl">Pembelian Bulan Ini</div>
              <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
            </div>
            <div className="val small">{formatRupiah(stats.pembelianBulanIni)}</div>
          </div>
          <div className="stat-cell profit">
            <div className="cell-top">
              <div className="lbl">Laba Kotor Bulan Ini</div>
              <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
            </div>
            <div className="val small">{formatRupiah(stats.labaKotorBulanIni)}</div>
          </div>
        </div>
      )}

      <div className="section-lbl">Tren Penjualan</div>
      <div className="panels-trend">
        <div className="panel">
          <div className="panel-head">
            <h3>{PERIOD_OPTIONS.find((o) => o.value === period)?.label} Terakhir</h3>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="chart-legend-toggle">
            <label>
              <input type="checkbox" checked={showPenjualan} onChange={(e) => setShowPenjualan(e.target.checked)} />
              <span className="dot" style={{ background: "#0B6FDB" }}></span>
              Tren Penjualan
            </label>
            <label>
              <input type="checkbox" checked={showLaba} onChange={(e) => setShowLaba(e.target.checked)} />
              <span className="dot" style={{ background: "#4F7A5C" }}></span>
              Laba Kotor
            </label>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="chartFadePenjualan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0B6FDB" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0B6FDB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="chartFadeLaba" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F7A5C" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#4F7A5C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                interval={Math.max(0, Math.floor((trend.points?.length || 1) / 5) - 1)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={44}
                tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                tickFormatter={formatAxisLabel}
              />
              <RechartsTooltip content={<TrendTooltip showPenjualan={showPenjualan} showLaba={showLaba} />} />
              {showPenjualan && (
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Tren Penjualan"
                  stroke="#0B6FDB"
                  strokeWidth={2.5}
                  fill="url(#chartFadePenjualan)"
                  dot={{ r: 3, fill: "#fff", stroke: "#0B6FDB", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#0B6FDB", stroke: "#fff", strokeWidth: 2 }}
                />
              )}
              {showLaba && (
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Laba Kotor"
                  stroke="#4F7A5C"
                  strokeWidth={2.5}
                  fill="url(#chartFadeLaba)"
                  dot={{ r: 3, fill: "#fff", stroke: "#4F7A5C", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#4F7A5C", stroke: "#fff", strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>5 Kategori Terlaris</h3></div>
          {kategoriTerlaris.length === 0 ? (
            <p className="empty-row">Belum ada data penjualan.</p>
          ) : (
            <div className="pie-wrap">
              <ResponsiveContainer width={140} height={140}>
                <RePieChart>
                  <Pie
                    data={kategoriTerlaris}
                    dataKey="val"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={65}
                    isAnimationActive={false}
                  >
                    {kategoriTerlaris.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={1} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => formatRupiahPenuh(value)} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {kategoriTerlaris.map((k, i) => (
                  <div className="row" key={i}>
                    <span className="dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                    {k.label}<b>{k.pct}%</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="section-lbl">Level Stok &amp; Prioritas</div>
      <div className="panels-3">
        <div className="panel">
          <div className="panel-head"><h3>Level Stok Keseluruhan</h3></div>
          <div className="gauge-track">
            {gaugeSegs.map((s, i) => (
              <div className="gauge-seg" key={i} style={{ width: s.pct + "%", background: s.color }}></div>
            ))}
          </div>
          <div className="gauge-legend">
            <div className="row"><span className="dot" style={{ background: "#4F7A5C" }}></span>Stok Aman <span className="sub">{totalStokBucket ? Math.round((stats.aman / totalStokBucket) * 100) : 0}%</span><b>{stats.aman}</b></div>
            <div className="row"><span className="dot" style={{ background: "#B8862E" }}></span>Stok Menipis <span className="sub">{totalStokBucket ? Math.round((stats.menipis / totalStokBucket) * 100) : 0}%</span><b>{stats.menipis}</b></div>
            <div className="row"><span className="dot" style={{ background: "#A0402C" }}></span>Stok Habis <span className="sub">{totalStokBucket ? Math.round((stats.habis / totalStokBucket) * 100) : 0}%</span><b>{stats.habis}</b></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Produk Paling Laris</h3></div>
          {produkTerlaris.length === 0 ? (
            <p className="empty-row">Belum ada data penjualan.</p>
          ) : (
            produkTerlaris.map((p, i) => (
              <div className="rank-item" key={i}>
                <div className="rank-num">{i + 1}</div>
                <div className="rank-name">{p.nama}</div>
                <div className="rank-val">{p.jumlah} terjual</div>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Perlu Direstok</h3><Link href="/stok-barang" className="see-all-link">Lihat semua →</Link></div>
          {perluDirestok.length === 0 ? (
            <p className="empty-row">Semua stok dalam kondisi aman.</p>
          ) : (
            perluDirestok.map((p, i) => (
              <div className="restock-item" key={i}>
                <span className="dot" style={{ background: p.status === "habis" ? "#A0402C" : "#B8862E" }}></span>
                <div className="restock-name">{p.nama}</div>
                <div className="restock-stok">{p.stok}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="section-lbl">Aktivitas Terbaru</div>
      <div className="panels-2">
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

function TrendTooltip({ active, payload, label, showPenjualan, showLaba }) {
  if (!active || !payload || payload.length === 0) return null;
  const penjualanEntry = payload.find((p) => p.dataKey === "value");
  const labaEntry = payload.find((p) => p.dataKey === "profit");
  const year = payload[0]?.payload?.year;
  return (
    <div className="chart-tooltip show" style={{ position: "static", transform: "none" }}>
      <div className="tt-date">{label}{year ? " " + year : ""}</div>
      {showPenjualan && penjualanEntry && (
        <div className="tt-val" style={{ color: "#0B6FDB" }}>Penjualan: {formatRupiahPenuh(penjualanEntry.value)}</div>
      )}
      {showLaba && labaEntry && (
        <div className="tt-val" style={{ color: "#4F7A5C" }}>Laba: {formatRupiahPenuh(labaEntry.value)}</div>
      )}
    </div>
  );
}
