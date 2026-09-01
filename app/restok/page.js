"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonStatRow, SkeletonTableRows } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { CSV_URLS, fetchCsvRows, findHeaderRow, formatRupiah, formatTanggal, parseAngkaIndonesia, parseTanggalToDate } from "@/lib/dashboardUtils";

const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function itemKosong() {
  return { nama: "", banyak: "", harga: "" };
}

function formKosong() {
  return { tanggal: todayISO(), distributor: "", status: "Cash", items: [itemKosong()] };
}

export default function RestokPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBulan, setFilterBulan] = useState("semua"); // "semua" atau index 0-11
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
  const [lastSync, setLastSync] = useState("Memuat...");
  const [refreshing, setRefreshing] = useState(false);

  // Form "+ Tambah Restok"
  const [namaBarangList, setNamaBarangList] = useState([]);
  const [scriptUrl, setScriptUrl] = useState("");
  const [scriptKey, setScriptKey] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(formKosong());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const supabase = createClient();

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
          total: parseAngkaIndonesia(r[idxTotal]),
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

  // Daftar nama barang dari DAFTAR BARANG, buat prediksi/autocomplete di form restok.
  async function loadNamaBarang() {
    try {
      const rows = await fetchCsvRows(CSV_URLS.stok);
      const headerIdx = findHeaderRow(rows, ["kode barang", "nama barang"]);
      if (headerIdx === -1) return;
      const header = rows[headerIdx].map((c) => (c || "").toString().trim().toLowerCase());
      const idxNama = header.indexOf("nama barang");
      if (idxNama === -1) return;

      const namaSet = new Set();
      rows.slice(headerIdx + 1).forEach((r) => {
        const nama = (r[idxNama] || "").toString().trim();
        if (nama) namaSet.add(nama);
      });
      setNamaBarangList(Array.from(namaSet).sort((a, b) => a.localeCompare(b, "id")));
    } catch (err) {
      console.warn("Gagal memuat daftar nama barang:", err);
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
    loadData();
    loadNamaBarang();
    loadScriptSettings();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadData(), loadNamaBarang()]);
    setTimeout(() => setRefreshing(false), 400);
  }

  function openForm() {
    setForm(formKosong());
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
  }

  function updateItem(idx, field, value) {
    setForm((prev) => {
      const items = prev.items.slice();
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  }

  function addItemRow() {
    setForm((prev) => ({ ...prev, items: [...prev.items, itemKosong()] }));
  }

  function removeItemRow(idx) {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev; // minimal 1 baris
      return { ...prev, items: prev.items.filter((_, i) => i !== idx) };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!scriptUrl || !scriptKey) {
      setFormError("URL/Key Google Apps Script belum diisi di halaman Pengaturan.");
      return;
    }
    if (!form.tanggal) {
      setFormError("Tanggal wajib diisi.");
      return;
    }

    const itemsValid = form.items
      .map((it) => ({
        nama_barang: it.nama.trim(),
        banyak: parseFloat(it.banyak),
        harga_beli: parseFloat(it.harga),
      }))
      .filter((it) => it.nama_barang && it.banyak > 0 && it.harga_beli >= 0);

    if (itemsValid.length === 0) {
      setFormError("Isi minimal 1 barang dengan Nama, Banyak, dan Harga Beli yang valid.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(scriptUrl, {
        method: "POST",
        body: JSON.stringify({
          key: scriptKey,
          aksi: "restok",
          tanggal: form.tanggal,
          distributor: form.distributor.trim(),
          status: form.status,
          items: itemsValid,
        }),
      });
      const result = await res.json();
      if (result?.error) throw new Error(result.error);

      setShowForm(false);
      setToast(`Restok tersimpan (${itemsValid.length} barang).`);
      await Promise.all([loadData(), loadNamaBarang()]);
    } catch (err) {
      console.warn("Gagal menyimpan restok:", err);
      setFormError("Gagal menyimpan ke spreadsheet. Cek koneksi internet lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  // Daftar nama distributor unik dari riwayat restok yang sudah ada, buat prediksi/autocomplete.
  const distributorList = useMemo(() => {
    const set = new Set();
    data.forEach((p) => {
      if (p.distributor) set.add(p.distributor);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [data]);

  const dataPeriode = useMemo(() => {
    if (filterBulan === "semua") return data;
    return data.filter((p) => {
      const d = parseTanggalToDate(p.tanggal);
      return d && d.getMonth() === Number(filterBulan) && d.getFullYear() === Number(filterTahun);
    });
  }, [data, filterBulan, filterTahun]);

  const filtered = dataPeriode.filter(
    (p) =>
      !search ||
      p.nama.toLowerCase().includes(search.toLowerCase()) ||
      p.distributor.toLowerCase().includes(search.toLowerCase())
  );
  const totalNilai = dataPeriode.reduce((s, p) => s + p.total, 0);
  const terakhir = dataPeriode.length ? formatTanggal(dataPeriode[dataPeriode.length - 1].tanggal, true) : "-";

  const tahunOptions = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 2; y--) tahunOptions.push(y);

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
          <button className="btn-primary" style={{ padding: "10px 16px" }} onClick={openForm}>
            + Tambah Restok
          </button>
        </>
      }
    >
      {toast && (
        <div className="setup-banner" style={{ display: "flex", background: "var(--sage-soft)", border: "1px solid var(--sage)", marginBottom: 16 }}>
          <div className="setup-ic">✅</div>
          <div>
            <b style={{ color: "var(--sage)" }}>{toast}</b>
          </div>
        </div>
      )}

      {(!scriptUrl || !scriptKey) && (
        <div className="setup-banner" style={{ display: "flex", background: "#FFF3E0", border: "1px solid #FFD8A8", marginBottom: 16 }}>
          <div className="setup-ic">⚠️</div>
          <div>
            <b style={{ color: "var(--brand-deep)" }}>URL/Key Apps Script belum diisi</b>
            <p style={{ color: "var(--brand-deep)" }}>
              Isi dulu di halaman Pengaturan (kolom yang sama dipakai Kasir) supaya tombol &quot;+ Tambah Restok&quot; bisa menyimpan ke spreadsheet.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonStatRow count={4} />
      ) : (
        <div className="stat-row fin">
          <div className="stat-cell">
            <div className="lbl">Total Transaksi</div>
            <div className="val">{dataPeriode.length || "–"}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Total Barang Masuk</div>
            <div className="val">{dataPeriode.reduce((s, p) => s + (parseFloat(p.banyak) || 0), 0)}</div>
          </div>
          <div className="stat-cell accent">
            <div className="lbl">Total Nilai Pembelian</div>
            <div className="val small">{formatRupiah(totalNilai)}</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">Restok Terakhir</div>
            <div className="val small">{terakhir}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Riwayat Restok Barang</h3>
          <div className="panel-controls">
            <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} style={{ border: "1.5px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
              <option value="semua">Semua Bulan</option>
              {BULAN_LABEL.map((b, i) => (
                <option key={i} value={i}>{b}</option>
              ))}
            </select>
            {filterBulan !== "semua" && (
              <select value={filterTahun} onChange={(e) => setFilterTahun(parseInt(e.target.value, 10))} style={{ border: "1.5px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                {tahunOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
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
              {loading && <SkeletonTableRows cols={8} rows={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="empty-row">Tidak ada transaksi restok pada periode ini.</td></tr>
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

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h2>+ Tambah Restok</h2>

            <form className="modal-form" onSubmit={handleSubmit}>
              {formError && <div className="error-msg">{formError}</div>}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: 1, minWidth: 160 }}>
                  <label>Tanggal</label>
                  <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 160 }}>
                  <label>Distributor</label>
                  <input
                    type="text"
                    list="daftar-distributor"
                    placeholder="Nama distributor"
                    value={form.distributor}
                    onChange={(e) => setForm({ ...form, distributor: e.target.value })}
                  />
                  <datalist id="daftar-distributor">
                    {distributorList.map((nama) => (
                      <option key={nama} value={nama} />
                    ))}
                  </datalist>
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    style={{ border: "1.5px solid var(--slate200)", borderRadius: 10, padding: "11px 13px", fontSize: 14 }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Titipan">Titipan</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--slate600)" }}>Barang</label>
                <datalist id="daftar-nama-barang">
                  {namaBarangList.map((nama) => (
                    <option key={nama} value={nama} />
                  ))}
                </datalist>

                {form.items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
                    <div className="field" style={{ flex: 3, minWidth: 160 }}>
                      {idx === 0 && <label>Nama Barang</label>}
                      <input
                        type="text"
                        list="daftar-nama-barang"
                        placeholder="Ketik nama barang..."
                        value={item.nama}
                        onChange={(e) => updateItem(idx, "nama", e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ flex: 1, minWidth: 90 }}>
                      {idx === 0 && <label>Banyak</label>}
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={item.banyak}
                        onChange={(e) => updateItem(idx, "banyak", e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ flex: 1.4, minWidth: 120 }}>
                      {idx === 0 && <label>Harga Beli/Pcs</label>}
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={item.harga}
                        onChange={(e) => updateItem(idx, "harga", e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => removeItemRow(idx)}
                      disabled={form.items.length <= 1}
                      style={{ height: 44 }}
                      title="Hapus baris ini"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button type="button" onClick={addItemRow} className="btn-cancel" style={{ marginTop: 10, padding: "8px 14px" }}>
                  + Tambah Baris Barang
                </button>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeForm}>Batal</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Restok"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
