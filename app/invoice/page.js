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

function itemFormKosong() {
  return { nama: "", qty: "" };
}

function formKosong() {
  return { customer: "", customerWa: "", status: "LUNAS", diskon: "", items: [itemFormKosong()] };
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

  // Form "+ Buat Invoice"
  const [showForm, setShowForm] = useState(false);
  const [scriptUrl, setScriptUrl] = useState("");
  const [scriptKey, setScriptKey] = useState("");
  const [daftarBarang, setDaftarBarang] = useState([]); // [{ nama, harga }]
  const [form, setForm] = useState(formKosong());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");

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
    loadDaftarBarang();
    loadScriptSettings();
  }, []);

  // Daftar barang + harga jual dari DAFTAR BARANG, buat autocomplete & auto-isi harga di form invoice.
  async function loadDaftarBarang() {
    try {
      const rows = await fetchCsvRows(CSV_URLS.stok);
      const headerIdx = findHeaderRow(rows, ["kode barang", "nama barang"]);
      if (headerIdx === -1) return;
      const header = rows[headerIdx].map((c) => (c || "").toString().trim().toLowerCase());
      const idxNama = header.indexOf("nama barang");
      const idxHarga = header.indexOf("harga jual");
      if (idxNama === -1) return;

      const list = [];
      rows.slice(headerIdx + 1).forEach((r) => {
        const nama = (r[idxNama] || "").toString().trim();
        if (!nama) return;
        list.push({ nama, harga: idxHarga > -1 ? parseAngkaIndonesia(r[idxHarga]) : 0 });
      });
      setDaftarBarang(list);
    } catch (err) {
      console.warn("Gagal memuat daftar barang:", err);
    }
  }

  async function loadScriptSettings() {
    try {
      const { data: row } = await supabase.from("settings").select("kasir_script_url, kasir_script_key").eq("id", 1).single();
      if (row) {
        setScriptUrl(row.kasir_script_url || "");
        setScriptKey(row.kasir_script_key || "");
      }
    } catch (err) {
      console.warn("Gagal memuat pengaturan script:", err);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function openForm() {
    setForm(formKosong());
    setFormError("");
    setShowForm(true);
  }

  function updateItem(idx, field, value) {
    setForm((prev) => {
      const items = prev.items.slice();
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  }

  function addItemRow() {
    setForm((prev) => ({ ...prev, items: [...prev.items, itemFormKosong()] }));
  }

  function removeItemRow(idx) {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== idx) };
    });
  }

  function hargaUntuk(nama) {
    const produk = daftarBarang.find((p) => p.nama.toLowerCase() === nama.trim().toLowerCase());
    return produk ? produk.harga : 0;
  }

  const formItemsValid = form.items
    .map((it) => ({ nama_produk: it.nama.trim(), qty: parseFloat(it.qty), harga: hargaUntuk(it.nama) }))
    .filter((it) => it.nama_produk && it.qty > 0);
  const formSubtotal = formItemsValid.reduce((s, it) => s + it.harga * it.qty, 0);
  const formDiskon = Math.max(0, Number(form.diskon) || 0);
  const formTotal = Math.max(0, formSubtotal - formDiskon);

  async function handleSubmitForm(e) {
    e.preventDefault();
    setFormError("");

    if (!scriptUrl || !scriptKey) {
      setFormError("URL/Key Google Apps Script belum diisi di halaman Pengaturan.");
      return;
    }
    if (formItemsValid.length === 0) {
      setFormError("Isi minimal 1 barang dengan Nama dan Qty yang valid.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(scriptUrl, {
        method: "POST",
        body: JSON.stringify({
          key: scriptKey,
          waktu: new Date().toISOString(),
          customer: form.customer.trim(),
          customer_wa: form.customerWa.trim(),
          status: form.status,
          diskon: formDiskon,
          items: formItemsValid.map((it) => ({ nama_produk: it.nama_produk, qty: it.qty })),
        }),
      });
      const result = await res.json();
      if (result?.error) throw new Error(result.error);

      setShowForm(false);
      setToast(`Invoice ${result.no_invoice || ""} berhasil dibuat.`);
      await loadData();
    } catch (err) {
      console.warn("Gagal membuat invoice:", err);
      setFormError("Gagal menyimpan ke spreadsheet. Cek koneksi internet lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

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
        <>
          <span className="last-sync">{lastSync}</span>
          <button className={`btn-refresh ${refreshing ? "spinning" : ""}`} onClick={handleRefresh}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Refresh
          </button>
          <button className="btn-primary" style={{ padding: "10px 16px" }} onClick={openForm}>
            + Buat Invoice
          </button>
        </>
      }
    >
      <div className="no-print">
        {toast && (
          <div className="setup-banner" style={{ display: "flex", background: "var(--sage-soft)", border: "1px solid var(--sage)", marginBottom: 16 }}>
            <div className="setup-ic">✅</div>
            <div><b style={{ color: "var(--sage)" }}>{toast}</b></div>
          </div>
        )}

        {(!scriptUrl || !scriptKey) && (
          <div className="setup-banner" style={{ display: "flex", background: "#FFF3E0", border: "1px solid #FFD8A8", marginBottom: 16 }}>
            <div className="setup-ic">⚠️</div>
            <div>
              <b style={{ color: "var(--brand-deep)" }}>URL/Key Apps Script belum diisi</b>
              <p style={{ color: "var(--brand-deep)" }}>Isi dulu di halaman Pengaturan supaya tombol &quot;+ Buat Invoice&quot; bisa menyimpan ke spreadsheet.</p>
            </div>
          </div>
        )}

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
              <div className="invoice-a-top">
                <div className="invoice-a-brand">
                  <b>{toko.nama_toko || "Taniku Agro"}</b>
                  <div className="storeinfo">
                    {toko.alamat}
                    {toko.whatsapp && <><br />WhatsApp: {toko.whatsapp}</>}
                  </div>
                </div>
                <div className="invoice-a-title">
                  <h1>INVOICE</h1>
                  <div className="no">{selected.noInvoice}</div>
                  <span className={`invoice-a-badge ${isLunas(selected.status) ? "lunas" : "kurang"}`}>
                    {isLunas(selected.status) ? "LUNAS" : "KURANG BAYAR"}
                  </span>
                </div>
              </div>

              <div className="invoice-meta-row">
                <div><b>Tanggal</b>{formatTanggal(selected.tanggal)}</div>
                {selected.customer && <div><b>Pelanggan</b>{selected.customer}</div>}
                {selected.customerWa && <div><b>No. WA</b>{selected.customerWa}</div>}
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

              <div className="invoice-totals">
                <div className="invoice-total-row grand"><span>TOTAL</span><span>{formatRupiah(selected.total)}</span></div>
              </div>

              <div className="invoice-a-footer">Terima kasih sudah berbelanja di {toko.nama_toko || "Taniku Agro"} 🌱</div>
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

      {showForm && (
        <div className="modal-overlay no-print" onClick={() => setShowForm(false)}>
          <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h2>+ Buat Invoice</h2>

            <form className="modal-form" onSubmit={handleSubmitForm}>
              {formError && <div className="error-msg">{formError}</div>}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: 1, minWidth: 180 }}>
                  <label>Nama Pelanggan</label>
                  <input type="text" placeholder="Nama pelanggan" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 180 }}>
                  <label>No. WA Pelanggan (opsional)</label>
                  <input type="text" placeholder="08xxxxxxxxxx" value={form.customerWa} onChange={(e) => setForm({ ...form, customerWa: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Status Bayar</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    style={{ border: "1.5px solid var(--slate200)", borderRadius: 10, padding: "11px 13px", fontSize: 14 }}
                  >
                    <option value="LUNAS">Lunas</option>
                    <option value="KURANG BAYAR">Kurang Bayar</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--slate600)" }}>Barang</label>
                <datalist id="daftar-nama-barang-invoice">
                  {daftarBarang.map((p) => (
                    <option key={p.nama} value={p.nama} />
                  ))}
                </datalist>

                {form.items.map((item, idx) => {
                  const harga = hargaUntuk(item.nama);
                  const qtyNum = parseFloat(item.qty) || 0;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
                      <div className="field" style={{ flex: 3, minWidth: 160 }}>
                        {idx === 0 && <label>Nama Barang</label>}
                        <input
                          type="text"
                          list="daftar-nama-barang-invoice"
                          placeholder="Ketik nama barang..."
                          value={item.nama}
                          onChange={(e) => updateItem(idx, "nama", e.target.value)}
                        />
                      </div>
                      <div className="field" style={{ flex: 1, minWidth: 80 }}>
                        {idx === 0 && <label>Qty</label>}
                        <input type="number" min="0" placeholder="0" value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                      </div>
                      <div className="field" style={{ flex: 1.4, minWidth: 120 }}>
                        {idx === 0 && <label>Subtotal</label>}
                        <input type="text" disabled value={harga && qtyNum ? formatRupiah(harga * qtyNum) : "-"} />
                      </div>
                      <button type="button" className="btn-delete" onClick={() => removeItemRow(idx)} disabled={form.items.length <= 1} style={{ height: 44 }} title="Hapus baris ini">✕</button>
                    </div>
                  );
                })}

                <button type="button" onClick={addItemRow} className="btn-cancel" style={{ marginTop: 10, padding: "8px 14px" }}>
                  + Tambah Baris Barang
                </button>
              </div>

              <div className="field" style={{ marginTop: 14, maxWidth: 200 }}>
                <label>Diskon (Rp, opsional)</label>
                <input type="number" min="0" placeholder="0" value={form.diskon} onChange={(e) => setForm({ ...form, diskon: e.target.value })} />
              </div>

              <div className="invoice-total-row grand" style={{ marginTop: 10 }}>
                <span>TOTAL</span>
                <span>{formatRupiah(formTotal)}</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Batal</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
