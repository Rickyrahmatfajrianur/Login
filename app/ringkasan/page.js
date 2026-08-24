"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import {
  CSV_URLS,
  fetchCsvRows,
  findHeaderRow,
  computeStatus,
  guessCategory,
  formatRupiahShort,
  formatRupiahPenuh,
  formatTanggal,
  parseTanggalToDate,
  catmullRomPath,
  niceMaxScale,
  fetchSettings,
  DEFAULT_STOK_MIN,
} from "@/lib/dashboardUtils";

const PIE_COLORS = ["#0B6FDB", "#4F7A5C", "#B8862E", "#3D7A7A", "#A0402C"];

function formatAxisLabel(n) {
  if (n === 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "jt";
  if (n >= 1000) return Math.round(n / 1000) + "rb";
  return String(n);
}

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 Hari" },
  { value: "30d", label: "30 Hari" },
  { value: "3m", label: "3 Bulan" },
  { value: "6m", label: "6 Bulan" },
  { value: "12m", label: "12 Bulan" },
];

function computeTrend(penjualanList, period) {
  const now = new Date();
  const plotLeft = 50, plotRight = 740, plotTop = 10, plotBottom = 170;
  let points = [];

  if (period.endsWith("d")) {
    const numDays = parseInt(period, 10);
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      points.push({ matchDate: d.toDateString(), label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), value: 0 });
    }
    penjualanList.forEach((p) => {
      const d = parseTanggalToDate(p.tanggal);
      if (!d) return;
      const match = points.find((pt) => pt.matchDate === d.toDateString());
      if (match) match.value += p.hargaAkhir;
    });
  } else {
    const numMonths = parseInt(period, 10);
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      points.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }), value: 0 });
    }
    penjualanList.forEach((p) => {
      const d = parseTanggalToDate(p.tanggal);
      if (!d) return;
      const match = points.find((pt) => pt.month === d.getMonth() && pt.year === d.getFullYear());
      if (match) match.value += p.hargaAkhir;
    });
  }

  const maxVal = niceMaxScale(Math.max(...points.map((d) => d.value), 1000000));
  const coords = points.map((pt, i) => {
    const x = points.length > 1 ? plotLeft + (i / (points.length - 1)) * (plotRight - plotLeft) : (plotLeft + plotRight) / 2;
    const y = plotBottom - (pt.value / maxVal) * (plotBottom - plotTop);
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  });
  const linePath = catmullRomPath(coords);
  const areaPath = linePath + ` L${plotRight},${plotBottom} L${plotLeft},${plotBottom} Z`;

  return { points: points.map((pt, i) => ({ ...pt, coord: coords[i] })), maxVal, linePath, areaPath };
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
  const [period, setPeriod] = useState("30d");
  const trend = useMemo(() => computeTrend(penjualanRaw, period), [penjualanRaw, period]);
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);
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
            total: parseFloat((r[idxTotal] || "").toString().replace(/[^0-9.-]/g, "")) || 0,
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
            profit: parseFloat((r[idxProfit] || "").toString().replace(/[^0-9.-]/g, "")) || 0,
            hargaAkhir: parseFloat((r[idxHargaAkhir] || "").toString().replace(/[^0-9.-]/g, "")) || 0,
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

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(trend.maxVal * f));
  const numXLabels = Math.min(6, trend.points.length);
  const xLabelIdx = trend.points.length > 1
    ? Array.from({ length: numXLabels }, (_, i) => Math.round((i * (trend.points.length - 1)) / (numXLabels - 1)))
    : [0];

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

      <div className="section-lbl">Ringkasan Keuangan</div>
      <div className="stat-row fin">
        <div className="stat-cell accent">
          <div className="cell-top">
            <div className="lbl">Penjualan Hari Ini</div>
            <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
          </div>
          <div className="val small">{formatRupiahShort(stats.penjualanHariIni)}</div>
        </div>
        <div className="stat-cell accent">
          <div className="cell-top">
            <div className="lbl">Penjualan Bulan Ini</div>
            <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          </div>
          <div className="val small">{formatRupiahShort(stats.penjualanBulanIni)}</div>
        </div>
        <div className="stat-cell">
          <div className="cell-top">
            <div className="lbl">Pembelian Bulan Ini</div>
            <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
          </div>
          <div className="val small">{formatRupiahShort(stats.pembelianBulanIni)}</div>
        </div>
        <div className="stat-cell profit">
          <div className="cell-top">
            <div className="lbl">Laba Kotor Bulan Ini</div>
            <svg className="cell-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
          </div>
          <div className="val small">{formatRupiahShort(stats.labaKotorBulanIni)}</div>
        </div>
      </div>

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
          <div className="chart-wrap" id="chartWrap">
            <svg className="chart-svg" viewBox="0 0 750 195" preserveAspectRatio="none" id="chartSvg">
              <defs>
                <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0B6FDB" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#0B6FDB" stopOpacity="0" />
                </linearGradient>
              </defs>

              <g>
                {yLabels.map((v, i) => {
                  const y = 170 - (v / (trend.maxVal || 1)) * 160;
                  return (
                    <g key={i}>
                      <line x1="50" y1={y} x2="740" y2={y} className="grid-line" />
                      <text x="42" y={y + 3} className="axis-label" textAnchor="end">{formatAxisLabel(v)}</text>
                    </g>
                  );
                })}
              </g>

              {trend.linePath && (
                <>
                  <path d={trend.linePath} fill="none" stroke="#0B6FDB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={trend.areaPath} fill="url(#chartFade)" />
                </>
              )}

              <g id="chartPointsRingkasan">
                {trend.points && trend.points.map((p, i) => (
                  <ChartPoint key={i} x={p.coord[0]} y={p.coord[1]} date={p.label} value={p.value} />
                ))}
              </g>

              <g>
                {xLabelIdx.map((i) => {
                  const p = trend.points && trend.points[i];
                  if (!p) return null;
                  return (
                    <text key={i} x={p.coord[0]} y="188" className="axis-label" textAnchor="middle">{p.label}</text>
                  );
                })}
              </g>
            </svg>
            <div className="chart-tooltip" id="chartTooltipRingkasan"></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>5 Kategori Terlaris</h3></div>
          {kategoriTerlaris.length === 0 ? (
            <p className="empty-row">Belum ada data penjualan.</p>
          ) : (
            <div className="pie-wrap">
              <PieChart data={kategoriTerlaris} />
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

function PieChart({ data }) {
  const cx = 65, cy = 65, r = 60;
  const total = data.reduce((s, d) => s + d.val, 0) || 1;
  let startAngle = -90;
  const paths = data.map((d, i) => {
    const angle = (d.val / total) * 360;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
    const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
    const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
    const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;
    const path = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    startAngle = endAngle;
    return path;
  });
  return (
    <svg viewBox="0 0 130 130" className="pie-svg">
      {paths.map((p, i) => (
        <path key={i} d={p} fill={PIE_COLORS[i % PIE_COLORS.length]} />
      ))}
    </svg>
  );
}

function ChartPoint({ x, y, date, value }) {
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const tooltip = document.getElementById("chartTooltipRingkasan");
    const svg = document.getElementById("chartSvg");
    const wrap = document.getElementById("chartWrap");
    if (!hover || !tooltip || !svg || !wrap) {
      if (tooltip) tooltip.classList.remove("show");
      return;
    }
    tooltip.innerHTML = `<div class="tt-date">${date} ${new Date().getFullYear()}</div><div class="tt-val">${formatRupiahPenuh(value)}</div>`;
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const scaleX = svgRect.width / 750;
    const scaleY = svgRect.height / 195;
    tooltip.style.left = (svgRect.left - wrapRect.left) + x * scaleX + "px";
    tooltip.style.top = (svgRect.top - wrapRect.top) + y * scaleY + "px";
    tooltip.classList.add("show");
  }, [hover, x, y, date, value]);

  return (
    <>
      <circle cx={x} cy={y} r={hover ? 5 : 3} className="chart-point" />
      <circle
        cx={x} cy={y} r={14} className="chart-point-hit"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onTouchStart={() => setHover(true)}
      />
    </>
  );
}
