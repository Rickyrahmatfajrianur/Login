"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonStatRow, SkeletonTableRows } from "@/components/Skeleton";
import {
  CSV_URLS,
  fetchCsvRows,
  findHeaderRow,
  formatRupiah,
  formatTanggal,
  parseTanggalToDate,
  parseAngkaIndonesia,
} from "@/lib/dashboardUtils";

const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function LaporanPage() {
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth());
  const [tahun, setTahun] = useState(now.getFullYear());
  const [restokAll, setRestokAll] = useState([]);
  const [penjualanAll, setPenjualanAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const [restokRows, penjualanRows] = await Promise.all([
        fetchCsvRows(CSV_URLS.restok),
        fetchCsvRows(CSV_URLS.penjualan),
      ]);

      const restokIdx = findHeaderRow(restokRows, ["tanggal", "nama barang", "distributor"]);
      let restokList = [];
      if (restokIdx > -1) {
        const h = restokRows[restokIdx].map((c) => (c || "").toString().trim().toLowerCase());
        const idxTgl = h.indexOf("tanggal");
        const idxDist = h.indexOf("distributor");
        const idxNama = h.indexOf("nama barang");
        const idxBanyak = h.indexOf("banyak barang");
        const idxTotal = h.indexOf("total");
        restokList = restokRows.slice(restokIdx + 1)
          .map((r) => ({
            tanggal: (r[idxTgl] || "").toString().trim(),
            distributor: (r[idxDist] || "").toString().trim(),
            nama: (r[idxNama] || "").toString().trim(),
            banyak: parseFloat(r[idxBanyak]) || 0,
            total: parseAngkaIndonesia(r[idxTotal]),
          }))
          .filter((p) => p.nama);
      }

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

      setRestokAll(restokList);
      setPenjualanAll(penjualanList);
      setLastSync("Diperbarui: " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat laporan:", err);
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

  const restokPeriode = useMemo(
    () => restokAll.filter((r) => {
      const d = parseTanggalToDate(r.tanggal);
      return d && d.getMonth() === bulan && d.getFullYear() === tahun;
    }),
    [restokAll, bulan, tahun]
  );

  const penjualanPeriode = useMemo(
    () => penjualanAll.filter((p) => {
      const d = parseTanggalToDate(p.tanggal);
      return d && d.getMonth() === bulan && d.getFullYear() === tahun;
    }),
    [penjualanAll, bulan, tahun]
  );

  const totalPembelian = restokPeriode.reduce((s, r) => s + r.total, 0);
  const totalPenjualan = penjualanPeriode.reduce((s, p) => s + p.hargaAkhir, 0);
  const labaKotor = penjualanPeriode.reduce((s, p) => s + p.profit, 0);

  const periodeLabel = `${BULAN_LABEL[bulan]} ${tahun}`;

  function exportExcel() {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();

      const ringkasanData = [
        ["Laporan Bulanan Taniku Agro"],
        [periodeLabel],
        [],
        ["Total Penjualan", totalPenjualan],
        ["Total Pembelian", totalPembelian],
        ["Laba Kotor", labaKotor],
        ["Jumlah Transaksi Penjualan", penjualanPeriode.length],
        ["Jumlah Transaksi Restok", restokPeriode.length],
      ];
      const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);
      XLSX.utils.book_append_sheet(wb, wsRingkasan, "Ringkasan");

      const penjualanRows = penjualanPeriode.map((p) => ({
        Tanggal: formatTanggal(p.tanggal),
        Produk: p.nama,
        Customer: p.customer,
        Jumlah: p.banyak,
        "Harga Akhir": p.hargaAkhir,
        Profit: p.profit,
      }));
      const wsPenjualan = XLSX.utils.json_to_sheet(penjualanRows);
      XLSX.utils.book_append_sheet(wb, wsPenjualan, "Penjualan");

      const restokRows = restokPeriode.map((r) => ({
        Tanggal: formatTanggal(r.tanggal),
        Produk: r.nama,
        Distributor: r.distributor,
        Jumlah: r.banyak,
        Total: r.total,
      }));
      const wsRestok = XLSX.utils.json_to_sheet(restokRows);
      XLSX.utils.book_append_sheet(wb, wsRestok, "Restok");

      XLSX.writeFile(wb, `Laporan-TanikuAgro-${BULAN_LABEL[bulan]}-${tahun}.xlsx`);
    });
  }

  function exportPDF() {
    Promise.all([import("jspdf"), import("jspdf-autotable")]).then(([{ default: jsPDF }, autoTableModule]) => {
      const autoTable = autoTableModule.default;
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("Laporan Bulanan — Taniku Agro", 14, 18);
      doc.setFontSize(11);
      doc.text(periodeLabel, 14, 26);

      autoTable(doc, {
        startY: 34,
        head: [["Ringkasan", "Nilai"]],
        body: [
          ["Total Penjualan", formatRupiah(totalPenjualan)],
          ["Total Pembelian", formatRupiah(totalPembelian)],
          ["Laba Kotor", formatRupiah(labaKotor)],
          ["Jumlah Transaksi Penjualan", String(penjualanPeriode.length)],
          ["Jumlah Transaksi Restok", String(restokPeriode.length)],
        ],
        theme: "grid",
        headStyles: { fillColor: [11, 111, 219] },
      });

      let nextY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text("Detail Penjualan", 14, nextY);
      autoTable(doc, {
        startY: nextY + 4,
        head: [["Tanggal", "Produk", "Customer", "Jumlah", "Harga Akhir"]],
        body: penjualanPeriode.map((p) => [formatTanggal(p.tanggal), p.nama, p.customer || "-", String(p.banyak), formatRupiah(p.hargaAkhir)]),
        theme: "striped",
        headStyles: { fillColor: [11, 111, 219] },
        styles: { fontSize: 9 },
      });

      nextY = doc.lastAutoTable.finalY + 12;
      doc.text("Detail Restok", 14, nextY);
      autoTable(doc, {
        startY: nextY + 4,
        head: [["Tanggal", "Produk", "Distributor", "Jumlah", "Total"]],
        body: restokPeriode.map((r) => [formatTanggal(r.tanggal), r.nama, r.distributor || "-", String(r.banyak), formatRupiah(r.total)]),
        theme: "striped",
        headStyles: { fillColor: [11, 111, 219] },
        styles: { fontSize: 9 },
      });

      doc.save(`Laporan-TanikuAgro-${BULAN_LABEL[bulan]}-${tahun}.pdf`);
    });
  }

  const tahunOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) tahunOptions.push(y);

  return (
    <DashboardLayout
      title="Laporan"
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
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={bulan} onChange={(e) => setBulan(parseInt(e.target.value, 10))} style={{ border: "1.5px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13.5 }}>
              {BULAN_LABEL.map((b, i) => (
                <option key={i} value={i}>{b}</option>
              ))}
            </select>
            <select value={tahun} onChange={(e) => setTahun(parseInt(e.target.value, 10))} style={{ border: "1.5px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13.5 }}>
              {tahunOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-add" onClick={exportExcel} disabled={loading}>⬇ Excel</button>
            <button className="btn-add" onClick={exportPDF} disabled={loading} style={{ background: "var(--rust)" }}>⬇ PDF</button>
          </div>
        </div>
      </div>

      <div className="section-lbl">Ringkasan {periodeLabel}</div>
      {loading ? (
        <SkeletonStatRow count={4} />
      ) : (
        <div className="stat-row fin">
          <div className="stat-cell accent">
            <div className="lbl">Total Penjualan</div>
            <div className="val small">{formatRupiah(totalPenjualan)}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Total Pembelian</div>
            <div className="val small">{formatRupiah(totalPembelian)}</div>
          </div>
          <div className="stat-cell profit">
            <div className="lbl">Laba Kotor</div>
            <div className="val small">{formatRupiah(labaKotor)}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Total Transaksi</div>
            <div className="val">{penjualanPeriode.length + restokPeriode.length}</div>
          </div>
        </div>
      )}

      <div className="section-lbl">Detail Penjualan</div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Produk</th><th>Customer</th><th>Jumlah</th><th>Harga Akhir</th></tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={5} rows={4} />}
              {!loading && penjualanPeriode.length === 0 && <tr><td colSpan={5} className="empty-row">Tidak ada transaksi penjualan di periode ini.</td></tr>}
              {!loading && penjualanPeriode.map((p, i) => (
                <tr key={i}>
                  <td>{formatTanggal(p.tanggal)}</td>
                  <td className="prod-name">{p.nama}</td>
                  <td>{p.customer || "-"}</td>
                  <td className="stok-val">{p.banyak}</td>
                  <td className="stok-val">{formatRupiah(p.hargaAkhir)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-lbl">Detail Restok</div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Produk</th><th>Distributor</th><th>Jumlah</th><th>Total</th></tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={5} rows={4} />}
              {!loading && restokPeriode.length === 0 && <tr><td colSpan={5} className="empty-row">Tidak ada transaksi restok di periode ini.</td></tr>}
              {!loading && restokPeriode.map((r, i) => (
                <tr key={i}>
                  <td>{formatTanggal(r.tanggal)}</td>
                  <td className="prod-name">{r.nama}</td>
                  <td>{r.distributor || "-"}</td>
                  <td className="stok-val">{r.banyak}</td>
                  <td className="stok-val">{formatRupiah(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
