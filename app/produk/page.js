"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { SkeletonTableRows } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  { id: "herbisida", label: "Herbisida" },
  { id: "fungisida", label: "Fungisida" },
  { id: "insektisida", label: "Insektisida" },
  { id: "akarisida", label: "Akarisida" },
  { id: "nematisida", label: "Nematisida" },
  { id: "moluskisida", label: "Moluskisida" },
  { id: "rodentisida", label: "Rodentisida" },
  { id: "bakterisida", label: "Bakterisida" },
  { id: "zpt", label: "ZPT" },
  { id: "perekat", label: "Perekat & Surfaktan" },
  { id: "pupuk", label: "Pupuk" },
  { id: "benih", label: "Benih" },
  { id: "biopestisida", label: "Biopestisida" },
  { id: "alat", label: "Alat Pertanian" },
  { id: "sparepart", label: "Spare Part" },
  { id: "lainnya", label: "Lainnya" },
];

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const emptyForm = {
  id: "",
  name: "",
  cat: "herbisida",
  size: "",
  price: "",
  price_grosir: "",
  img: "",
  img2: "",
  img3: "",
  is_hidden: false,
  description: "",
  active_ingredient: "",
  target: "",
  long_desc: "",
};

export default function ProdukPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua"); // semua | tampil | disembunyikan
  const [catFilter, setCatFilter] = useState("semua");
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [uploading, setUploading] = useState(null); // null | "img" | "img2" | "img3"
  const [uploadError, setUploadError] = useState("");
  const [idEditedManually, setIdEditedManually] = useState(false);
  const [nameMatches, setNameMatches] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (!error) setProducts(data || []);
    setLoading(false);
  }

  async function handleFileUpload(file, field) {
    if (!file) return;
    setUploading(field);
    setUploadError("");

    // Bersihkan nama file: huruf kecil, spasi jadi strip, tambah waktu biar unik
    const cleanName = file.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-]/g, "");
    const fileName = `${Date.now()}-${cleanName}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, { upsert: false });

    if (error) {
      setUploadError("Gagal unggah foto: " + error.message);
      setUploading(null);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    setForm((prev) => ({ ...prev, [field]: publicUrlData.publicUrl }));
    setUploading(null);
  }

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setErrorMsg("");
    setUploadError("");
    setIdEditedManually(false);
    setNameMatches([]);
    setShowModal(true);
  }

  function openEditModal(p) {
    setOpenMenuId(null);
    setEditingId(p.id);
    setForm({
      id: p.id,
      name: p.name || "",
      cat: p.cat || "herbisida",
      size: p.size || "",
      price: p.price ?? "",
      price_grosir: p.price_grosir ?? "",
      img: p.img || "",
      img2: p.img2 || "",
      img3: p.img3 || "",
      is_hidden: p.is_hidden || false,
      description: p.description || "",
      active_ingredient: p.active_ingredient || "",
      target: p.target || "",
      long_desc: p.long_desc || "",
    });
    setErrorMsg("");
    setUploadError("");
    setNameMatches([]);
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    if (!form.id || !form.name) {
      setErrorMsg("ID dan Nama Produk wajib diisi.");
      setSaving(false);
      return;
    }

    let result;
    const payload = {
      ...form,
      price: form.price === "" ? null : parseFloat(form.price),
      price_grosir: form.price_grosir === "" ? null : parseFloat(form.price_grosir),
    };
    if (editingId) {
      result = await supabase.from("products").update(payload).eq("id", editingId);
    } else {
      result = await supabase.from("products").insert(payload);
    }

    setSaving(false);

    if (result.error) {
      setErrorMsg("Gagal menyimpan: " + result.error.message);
      return;
    }

    setShowModal(false);
    loadProducts();
  }

  async function handleDelete(id) {
    setOpenMenuId(null);
    if (!confirm("Yakin ingin menghapus produk ini?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) loadProducts();
  }

  async function handleToggleHidden(p) {
    setOpenMenuId(null);
    const { error } = await supabase.from("products").update({ is_hidden: !p.is_hidden }).eq("id", p.id);
    if (!error) loadProducts();
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Yakin ingin menghapus ${selectedIds.length} produk yang dipilih?`)) return;
    const { error } = await supabase.from("products").delete().in("id", selectedIds);
    if (!error) {
      setSelectedIds([]);
      loadProducts();
    }
  }

  async function handleBulkVisibility(hide) {
    const { error } = await supabase.from("products").update({ is_hidden: hide }).in("id", selectedIds);
    if (!error) {
      setSelectedIds([]);
      loadProducts();
    }
  }

  function handleExportCsv() {
    const header = ["ID", "Nama Produk", "Kategori", "Ukuran", "Harga", "Harga Grosir", "Status", "Diperbarui"];
    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((p) => [
      p.id,
      p.name,
      CATEGORIES.find((c) => c.id === p.cat)?.label || p.cat,
      p.size || "",
      p.price ?? "",
      p.price_grosir ?? "",
      p.is_hidden ? "Disembunyikan" : "Tampil",
      p.updated_at ? new Date(p.updated_at).toLocaleDateString("id-ID") : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `master-produk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const countTampil = products.filter((p) => !p.is_hidden).length;
  const countDisembunyikan = products.filter((p) => p.is_hidden).length;

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "semua" || p.cat === catFilter;
    const matchStatus =
      statusFilter === "semua" || (statusFilter === "tampil" ? !p.is_hidden : p.is_hidden);
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <DashboardLayout title="Master Produk">
      <div className="tabs-row">
        <button className={`tab-btn ${statusFilter === "semua" ? "active" : ""}`} onClick={() => setStatusFilter("semua")}>
          Semua ({products.length})
        </button>
        <button className={`tab-btn ${statusFilter === "tampil" ? "active" : ""}`} onClick={() => setStatusFilter("tampil")}>
          Tampil ({countTampil})
        </button>
        <button className={`tab-btn ${statusFilter === "disembunyikan" ? "active" : ""}`} onClick={() => setStatusFilter("disembunyikan")}>
          Disembunyikan ({countDisembunyikan})
        </button>
      </div>

      <div className="toolbar-row2">
        <input
          type="text"
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, border: "1.5px solid var(--line)", borderRadius: 10, padding: "9px 13px", fontSize: 13.5 }}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="semua">Semua Kategori</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <button className="btn-outline" onClick={handleExportCsv}>⬇ Export</button>
        <button className="btn-add" onClick={openAddModal}>+ Tambah Produk</button>
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-bar">
          <b>{selectedIds.length} produk dipilih</b>
          <div className="spacer" />
          <button className="btn-outline" onClick={() => handleBulkVisibility(false)}>Tampilkan</button>
          <button className="btn-outline" onClick={() => handleBulkVisibility(true)}>Sembunyikan</button>
          <button className="btn-outline" style={{ color: "var(--red)" }} onClick={handleBulkDelete}>Hapus</button>
          <button className="btn-outline" onClick={() => setSelectedIds([])}>Batal</button>
        </div>
      )}

      <div className="produk-table">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleSelectAll} />
                </th>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Harga</th>
                <th>Harga Grosir</th>
                <th>Status</th>
                <th>Diperbarui</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={8} rows={6} />}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 30 }}>
                    Tidak ada produk yang cocok.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td>
                      <div className="prod-cell">
                        <div className="prod-thumb">
                          {p.img ? <img src={p.img} alt={p.name} /> : <span className="prod-thumb-empty">📦</span>}
                        </div>
                        <div className="prod-name-cell">
                          <div className="name">{p.name}</div>
                          <div className="sub">{p.size || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="chip">{CATEGORIES.find((c) => c.id === p.cat)?.label || p.cat}</span></td>
                    <td>{p.price ? "Rp " + Number(p.price).toLocaleString("id-ID") : "-"}</td>
                    <td>{p.price_grosir ? "Rp " + Number(p.price_grosir).toLocaleString("id-ID") : "-"}</td>
                    <td>
                      {p.is_hidden ? (
                        <span className="status-badge status-menipis">Disembunyikan</span>
                      ) : (
                        <span className="status-badge status-aman">Tampil</span>
                      )}
                    </td>
                    <td>{p.updated_at ? new Date(p.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</td>
                    <td>
                      <div className="row-menu-wrap">
                        <button className="btn-dots" onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}>⋯</button>
                        {openMenuId === p.id && (
                          <>
                            <div className="row-menu-overlay" onClick={() => setOpenMenuId(null)} />
                            <div className="row-menu">
                              <button onClick={() => openEditModal(p)}>Edit</button>
                              <button onClick={() => handleToggleHidden(p)}>{p.is_hidden ? "Tampilkan" : "Sembunyikan"}</button>
                              <button className="danger" onClick={() => handleDelete(p.id)}>Hapus</button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ marginBottom: 0 }}>{editingId ? "Edit Produk" : "Tambah Produk Baru"}</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Tutup"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--slate500)", display: "flex" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSave}>
              {errorMsg && <div className="error-msg">{errorMsg}</div>}

              <div className="field">
                <label>ID Unik {!editingId && <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(otomatis dari Nama Produk, bisa diubah kalau perlu)</span>}</label>
                <input
                  value={form.id}
                  disabled={!!editingId}
                  onChange={(e) => {
                    setIdEditedManually(true);
                    setForm({ ...form, id: e.target.value });
                  }}
                  required
                />
              </div>

              <div className="field">
                <label>Nama Produk</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      name,
                      id: !editingId && !idEditedManually ? slugify(name) : prev.id,
                    }));

                    if (name.trim().length >= 2) {
                      const matches = products
                        .filter((p) => p.id !== editingId && p.name.toLowerCase().includes(name.trim().toLowerCase()))
                        .slice(0, 5);
                      setNameMatches(matches);
                    } else {
                      setNameMatches([]);
                    }
                  }}
                  autoComplete="off"
                  required
                />
                {nameMatches.length > 0 && (
                  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", marginTop: 4 }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--wheat)", margin: "0 0 6px" }}>
                      ⚠️ Produk mirip sudah ada di database:
                    </p>
                    {nameMatches.map((m) => (
                      <div key={m.id} style={{ fontSize: 12.5, padding: "4px 0", color: "var(--ink-soft)" }}>
                        {m.name} {m.size ? `— ${m.size}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <label>Kategori</label>
                <select
                  value={form.cat}
                  onChange={(e) => setForm({ ...form, cat: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Ukuran / Kemasan</label>
                <input
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  placeholder="misal: 100 ml"
                />
              </div>

              <div className="field">
                <label>Harga (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="misal: 50000"
                />
              </div>

              <div className="field">
                <label>Harga Grosir (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={form.price_grosir}
                  onChange={(e) => setForm({ ...form, price_grosir: e.target.value })}
                  placeholder="misal: 45000"
                />
              </div>

              <div className="field">
                <label>Foto Produk (maksimal 3, foto pertama jadi foto utama)</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PhotoSlot label="Foto 1" field="img" form={form} uploading={uploading} onUpload={handleFileUpload} onRemove={() => setForm((prev) => ({ ...prev, img: "" }))} />
                  <PhotoSlot label="Foto 2" field="img2" form={form} uploading={uploading} onUpload={handleFileUpload} onRemove={() => setForm((prev) => ({ ...prev, img2: "" }))} />
                  <PhotoSlot label="Foto 3" field="img3" form={form} uploading={uploading} onUpload={handleFileUpload} onRemove={() => setForm((prev) => ({ ...prev, img3: "" }))} />
                </div>
                {uploadError && <p style={{ fontSize: 12.5, color: "#C53030", marginTop: 8 }}>{uploadError}</p>}
              </div>

              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.is_hidden}
                    onChange={(e) => setForm({ ...form, is_hidden: e.target.checked })}
                    style={{ width: 17, height: 17 }}
                  />
                  Sembunyikan produk ini dari website
                </label>
                <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6, marginLeft: 27 }}>
                  Produk tetap tersimpan di sini, cuma nggak muncul di katalog pelanggan. Cocok buat produk yang lagi kosong total atau belum siap dijual.
                </p>
              </div>

              <div className="field">
                <label>Deskripsi Singkat (tampil di kartu produk)</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Bahan Aktif</label>
                <input
                  value={form.active_ingredient}
                  onChange={(e) => setForm({ ...form, active_ingredient: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Target / Sasaran</label>
                <input
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Deskripsi Lengkap (tampil di halaman detail)</label>
                <textarea
                  rows={4}
                  value={form.long_desc}
                  onChange={(e) => setForm({ ...form, long_desc: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function PhotoSlot({ label, field, form, uploading, onUpload, onRemove }) {
  const value = form[field];
  const isUploadingThis = uploading === field;

  return (
    <div style={{ width: 110 }}>
      <div
        style={{
          width: 110, height: 110, borderRadius: 10, background: "#F7F9FB", border: "1px solid #DFE6EB",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative",
        }}
      >
        {value ? (
          <img src={value} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{isUploadingThis ? "Mengunggah..." : "Kosong"}</span>
        )}
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", margin: "6px 0 4px", textAlign: "center" }}>{label}</p>
      {value ? (
        <button
          type="button"
          onClick={onRemove}
          style={{ width: "100%", fontSize: 11, color: "var(--rust)", background: "none", border: "1px solid #F6E8E4", borderRadius: 8, padding: "4px 0", cursor: "pointer" }}
        >
          Hapus
        </button>
      ) : (
        <label style={{ display: "block", width: "100%", fontSize: 11, color: "var(--brand)", background: "none", border: "1px solid var(--brand-soft)", borderRadius: 8, padding: "4px 0", textAlign: "center", cursor: "pointer" }}>
          {isUploadingThis ? "..." : "Pilih"}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onUpload(e.target.files[0], field)}
            disabled={!!uploading}
            style={{ display: "none" }}
          />
        </label>
      )}
    </div>
  );
}
