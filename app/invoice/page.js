"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonStatRow, SkeletonTableRows } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { CSV_URLS, fetchCsvRows, findHeaderRow, formatRupiah, formatTanggal, parseAngkaIndonesia } from "@/lib/dashboardUtils";

function normalizeWa(nomor) {
  const digits = (nomor || "").toString().replace(/[^0-9]/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? "62" + digits.slice(1) : digits;
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua"); // semua | lunas | kurang
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toko, setToko] = useState({ nama_toko: "Taniku Agro", alamat: "", whatsapp: "" });
  const supabase = createClient();

  async function loadToko() {
    try {
      const { data } = await supabase.from("settings").select("nama_toko, alamat, whatsapp").eq("id", 1).single();
      if (data) setToko(data);
    } catch (err) {
      console.warn("Gagal memuat profil toko:", err);
    }
  }

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
      const idxNoInvoice = h.indexOf("no invoice");
      const idxWa = h.indexOf("no wa pelanggan");

      const grouped = {};
      rows.slice(headerIdx + 1).forEach((r) => {
        const nama = (r[idxNama] || "").toString().trim();
        const noInvoice = idxNoInvoice > -1 ? (r[idxNoInvoice] || "").toString().trim() : "";
        if (!nama || !noInvoice) return; // baris lama sebelum fitur invoice ada, atau baris kosong -- lewati

        if (!grouped[noInvoice]) {
          grouped[noInvoice] = {
            noInvoice,
            tanggal: (r[idxTgl] || "").toString().trim(),
            customer: (r[idxCustomer] || "").toString().trim(),
            customerWa: idxWa > -1 ? (r[idxWa] || "").toString().trim() : "",
            status: (r[idxStatus] || "").toString().trim(),
            items: [],
            total: 0,
            profit: 0,
          };
        }
        const hargaAkhir = parseAngkaIndonesia(r[idxHargaAkhir]);
        grouped[noInvoice].items.push({
          nama,
          banyak: (r[idxBanyak] || "0").toString().trim(),
          hargaAkhir,
        });
        grouped[noInvoice].total += hargaAkhir;
        grouped[noInvoice].profit += parseAngkaIndonesia(r[idxProfit]);
      });

      const list = Object.values(grouped);
      setInvoices(list);
      setLastSync("Diperbarui: " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Gagal memuat invoice:", err);
      setLastSync("Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    loadToko();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 400);
  }

  function isLunas(status) {
    return status.toUpperCase() !== "KURANG BAYAR";
  }

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      !search ||
      inv.noInvoice.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "semua" ||
      (statusFilter === "lunas" ? isLunas(inv.status) : !isLunas(inv.status));
    return matchSearch && matchStatus;
  });

  const totalNilai = invoices.reduce((s, inv) => s + inv.total, 0);
  const countKurangBayar = invoices.filter((inv) => !isLunas(inv.status)).length;

  function handlePrint() {
    window.print();
  }

  function handleKirimWa(inv) {
    const nomor = normalizeWa(inv.customerWa);
    if (!nomor) return;
    const baris = inv.items.map((it) => `- ${it.nama} x${it.banyak}: ${formatRupiah(it.hargaAkhir)}`).join("\n");
    const teks =
      `Halo ${inv.customer || ""}, ini invoice belanja di ${toko.nama_toko || "Taniku Agro"}:\n\n` +
      `No. Invoice: ${inv.noInvoice}\n` +
      `Tanggal: ${formatTanggal(inv.tanggal)}\n\n` +
      `${baris}\n\n` +
      `Total: ${formatRupiah(inv.total)}\n` +
      `Status: ${isLunas(inv.status) ? "Lunas" : "Kurang Bayar"}\n\n` +
      `Terima kasih!`;
    window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`, "_blank");
  }

  return (
    <DashboardLayout
      title="Invoice"
      headerRight={
        <span className="no-print">
          <span className="last-sync">{lastSync}</span>
          <button className={`btn-refresh ${refreshing ? "spinning" : ""}`} onClick={handleRefresh}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Refresh
          </button>
        </span>
      }
    >
      <div className="no-print">
        {loading ? (
          <SkeletonStatRow count={3} />
        ) : (
          <div className="stat-row">
            <div className="stat-cell">
              <div className="lbl">Total Invoice</div>
              <div className="val">{invoices.length || "–"}</div>
            </div>
            <div className="stat-cell accent">
              <div className="lbl">Total Nilai</div>
              <div className="val small">{formatRupiah(totalNilai)}</div>
            </div>
            <div className="stat-cell" style={{ borderColor: countKurangBayar > 0 ? "var(--rust)" : undefined }}>
              <div className="lbl">Kurang Bayar</div>
              <div className="val" style={{ color: countKurangBayar > 0 ? "var(--rust)" : undefined }}>{countKurangBayar}</div>
            </div>
          </div>
        )}

        <div className="tabs-row">
          <button className={`tab-btn ${statusFilter === "semua" ? "active" : ""}`} onClick={() => setStatusFilter("semua")}>Semua</button>
          <button className={`tab-btn ${statusFilter === "lunas" ? "active" : ""}`} onClick={() => setStatusFilter("lunas")}>Lunas</button>
          <button className={`tab-btn ${statusFilter === "kurang" ? "active" : ""}`} onClick={() => setStatusFilter("kurang")}>Kurang Bayar</button>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Daftar Invoice</h3>
            <div className="panel-controls">
              <div className="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input type="text" placeholder="Cari no. invoice / pelanggan..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No. Invoice</th><th>Tanggal</th><th>Pelanggan</th><th>Item</th><th>Total</th><th>Status</th><th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonTableRows cols={7} rows={6} />}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="empty-row">Belum ada invoice yang tercatat.</td></tr>
                )}
                {!loading &&
                  filtered.slice().reverse().map((inv) => (
                    <tr key={inv.noInvoice} style={{ cursor: "pointer" }} onClick={() => setSelected(inv)}>
                      <td className="prod-name">{inv.noInvoice}</td>
                      <td>{formatTanggal(inv.tanggal)}</td>
                      <td>{inv.customer || "-"}</td>
                      <td className="stok-val">{inv.items.length}</td>
                      <td className="stok-val">{formatRupiah(inv.total)}</td>
                      <td>
                        {isLunas(inv.status) ? (
                          <span className="status-badge status-aman">Lunas</span>
                        ) : (
                          <span className="status-badge status-habis">Kurang Bayar</span>
                        )}
                      </td>
                      <td><button className="btn-edit" onClick={(e) => { e.stopPropagation(); setSelected(inv); }}>Lihat</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ marginBottom: 0 }}>Detail Invoice</h2>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="print-area">
              <div className="invoice-detail-head">
                <b>{toko.nama_toko || "Taniku Agro"}</b>
                <span>{toko.alamat}</span>
                {toko.whatsapp && <span>WhatsApp: {toko.whatsapp}</span>}
              </div>
              <div className="invoice-meta-row"><span>No. Invoice</span><b>{selected.noInvoice}</b></div>
              <div className="invoice-meta-row"><span>Tanggal</span><span>{formatTanggal(selected.tanggal)}</span></div>
              {selected.customer && <div className="invoice-meta-row"><span>Pelanggan</span><span>{selected.customer}</span></div>}
              <div className="invoice-meta-row">
                <span>Status</span>
                <span style={{ color: isLunas(selected.status) ? "var(--sage)" : "var(--rust)", fontWeight: 700 }}>
                  {isLunas(selected.status) ? "Lunas" : "Kurang Bayar"}
                </span>
              </div>

              <table className="invoice-table">
                <thead>
                  <tr><th>Barang</th><th className="num">Qty</th><th className="num">Subtotal</th></tr>
                </thead>
                <tbody>
                  {selected.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.nama}</td>
                      <td className="num">{it.banyak}</td>
                      <td className="num">{formatRupiah(it.hargaAkhir)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="invoice-total-row grand"><span>TOTAL</span><span>{formatRupiah(selected.total)}</span></div>
            </div>

            <div className="modal-actions no-print">
              <button className="btn-cancel" onClick={() => setSelected(null)}>Tutup</button>
              {selected.customerWa && (
                <button className="btn-cancel" style={{ color: "var(--sage)" }} onClick={() => handleKirimWa(selected)}>Kirim WA</button>
              )}
              <button className="btn-primary" onClick={handlePrint}>Cetak / PDF</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
