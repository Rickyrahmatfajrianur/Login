"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
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
  description: "",
  active_ingredient: "",
  target: "",
  long_desc: "",
};

export default function ProdukPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [uploading, setUploading] = useState(false);
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

  async function handleFileUpload(file) {
    if (!file) return;
    setUploading(true);
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
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    setForm((prev) => ({ ...prev, img: publicUrlData.publicUrl }));
    setUploading(false);
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
    setEditingId(p.id);
    setForm({
      id: p.id,
      name: p.name || "",
      cat: p.cat || "herbisida",
      size: p.size || "",
      price: p.price ?? "",
      price_grosir: p.price_grosir ?? "",
      img: p.img || "",
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
    if (!confirm("Yakin ingin menghapus produk ini?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) loadProducts();
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Master Produk">
      <div className="toolbar">
        <input
          type="text"
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-add" onClick={openAddModal}>
          + Tambah Produk
        </button>
      </div>

      <div className="produk-table">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th>Ukuran</th>
                <th>Harga</th>
                <th>Harga Grosir</th>
                <th style={{ width: 120 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    Tidak ada produk yang cocok.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{CATEGORIES.find((c) => c.id === p.cat)?.label || p.cat}</td>
                    <td>{p.size || "-"}</td>
                    <td>{p.price ? "Rp " + Number(p.price).toLocaleString("id-ID") : "-"}</td>
                    <td>{p.price_grosir ? "Rp " + Number(p.price_grosir).toLocaleString("id-ID") : "-"}</td>
                    <td>
                      <button className="btn-edit" onClick={() => openEditModal(p)}>
                        Edit
                      </button>
                      <button className="btn-delete" onClick={() => handleDelete(p.id)}>
                        Hapus
                      </button>
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
                <label>Foto Produk</label>
                {form.img && (
                  <img
                    src={form.img}
                    alt="Pratinjau"
                    style={{ width: 120, height: 120, objectFit: "contain", background: "#F7F9FB", borderRadius: 10, border: "1px solid #DFE6EB", marginBottom: 8 }}
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  disabled={uploading}
                />
                {uploading && <p style={{ fontSize: 12.5, color: "#64748B" }}>Mengunggah foto...</p>}
                {uploadError && <p style={{ fontSize: 12.5, color: "#C53030" }}>{uploadError}</p>}
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
