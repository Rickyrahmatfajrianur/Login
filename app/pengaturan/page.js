"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { ACCESS_PAGES } from "@/lib/permissions";

export default function PengaturanPage() {
  const [form, setForm] = useState({
    nama_toko: "", alamat: "", jam_operasional: "", whatsapp: "", metode_pembayaran: "", stok_minimum: 5, show_real_price: false,
    hero_heading: "", hero_lede: "", hero_typed_words: "",
    kasir_script_url: "", kasir_script_key: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok'|'error', text }
  const supabase = createClient();

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPages, setNewUserPages] = useState([]); // checklist izin akun baru
  const [userMsg, setUserMsg] = useState(null);
  const [addingUser, setAddingUser] = useState(false);

  // Edit izin akses akun yang sudah ada
  const [editingAccessUser, setEditingAccessUser] = useState(null); // { id, email, allowed_pages }
  const [editPages, setEditPages] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Konfirmasi password sebelum tambah/hapus/ubah izin pengguna
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'add'|'delete'|'editAccess', payload }
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
    } catch (err) {
      console.warn("Gagal memuat pengguna:", err);
    }
    setUsersLoading(false);
  }

  // Langkah 1: minta konfirmasi password dulu, belum eksekusi apa pun
  function handleAddUser(e) {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) return;
    if (newUserPages.length === 0) {
      setUserMsg({ type: "error", text: "Pilih minimal 1 halaman yang boleh diakses." });
      return;
    }
    setConfirmError("");
    setConfirmPassword("");
    setConfirmAction({ type: "add", payload: { email: newUserEmail, password: newUserPassword, allowedPages: newUserPages } });
  }

  function handleDeleteUser(id, email) {
    setConfirmError("");
    setConfirmPassword("");
    setConfirmAction({ type: "delete", payload: { id, email } });
  }

  function openEditAccess(u) {
    setEditingAccessUser(u);
    setEditPages(Array.isArray(u.allowed_pages) ? u.allowed_pages : []);
  }

  function handleSaveAccess() {
    setConfirmError("");
    setConfirmPassword("");
    setConfirmAction({ type: "editAccess", payload: { id: editingAccessUser.id, email: editingAccessUser.email, allowedPages: editPages } });
    setEditingAccessUser(null); // tutup modal Edit Akses dulu, biar nggak numpuk di belakang modal konfirmasi password
  }

  // Langkah 2: setelah password dikonfirmasi benar, baru eksekusi tambah/hapus/ubah izin
  async function handleConfirmPassword(e) {
    e.preventDefault();
    setConfirming(true);
    setConfirmError("");

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) {
        setConfirmError("Sesi login tidak ditemukan. Silakan login ulang.");
        setConfirming(false);
        return;
      }

      // Verifikasi password dengan mencoba login ulang pakai akun yang sedang aktif
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: confirmPassword,
      });

      if (authError) {
        setConfirmError("Password salah. Silakan coba lagi.");
        setConfirming(false);
        return;
      }

      // Password benar, lanjutkan aksi yang tertunda
      if (confirmAction.type === "add") {
        await executeAddUser(confirmAction.payload);
      } else if (confirmAction.type === "delete") {
        await executeDeleteUser(confirmAction.payload);
      } else if (confirmAction.type === "editAccess") {
        await executeEditAccess(confirmAction.payload);
      }

      setConfirmAction(null);
      setConfirmPassword("");
    } catch (err) {
      setConfirmError("Terjadi kesalahan. Coba lagi.");
    }
    setConfirming(false);
  }

  async function executeAddUser({ email, password, allowedPages }) {
    setAddingUser(true);
    setUserMsg(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, allowedPages }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUserMsg({ type: "error", text: data.error || "Gagal menambah pengguna." });
      } else {
        setUserMsg({ type: "ok", text: `Pengguna ${data.user.email} berhasil ditambahkan.` });
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserPages([]);
        setShowAddUser(false);
        loadUsers();
      }
    } catch (err) {
      setUserMsg({ type: "error", text: "Terjadi kesalahan. Coba lagi." });
    }
    setAddingUser(false);
  }

  async function executeDeleteUser({ id, email }) {
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setUserMsg({ type: "error", text: data.error || "Gagal menghapus pengguna." });
      } else {
        setUserMsg({ type: "ok", text: `Akun ${email} berhasil dihapus.` });
        loadUsers();
      }
    } catch (err) {
      setUserMsg({ type: "error", text: "Terjadi kesalahan. Coba lagi." });
    }
  }

  async function executeEditAccess({ id, email, allowedPages }) {
    setSavingAccess(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, allowedPages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUserMsg({ type: "error", text: data.error || "Gagal mengubah izin akses." });
      } else {
        setUserMsg({ type: "ok", text: `Izin akses ${email} berhasil diperbarui.` });
        setEditingAccessUser(null);
        loadUsers();
      }
    } catch (err) {
      setUserMsg({ type: "error", text: "Terjadi kesalahan. Coba lagi." });
    }
    setSavingAccess(false);
  }

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (!error && data) {
      setForm({
        nama_toko: data.nama_toko || "",
        alamat: data.alamat || "",
        jam_operasional: data.jam_operasional || "",
        whatsapp: data.whatsapp || "",
        metode_pembayaran: data.metode_pembayaran || "",
        stok_minimum: data.stok_minimum ?? 5,
        show_real_price: data.show_real_price ?? false,
        hero_heading: data.hero_heading || "",
        hero_lede: data.hero_lede || "",
        hero_typed_words: data.hero_typed_words || "",
        kasir_script_url: data.kasir_script_url || "",
        kasir_script_key: data.kasir_script_key || "",
      });
    } else {
      setMessage({ type: "error", text: "Tabel pengaturan belum ditemukan. Pastikan sudah menjalankan settings-schema.sql di Supabase." });
    }
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("settings")
      .update({
        nama_toko: form.nama_toko,
        alamat: form.alamat,
        jam_operasional: form.jam_operasional,
        whatsapp: form.whatsapp,
        metode_pembayaran: form.metode_pembayaran,
        stok_minimum: parseInt(form.stok_minimum, 10) || 5,
        show_real_price: form.show_real_price,
        hero_heading: form.hero_heading,
        hero_lede: form.hero_lede,
        hero_typed_words: form.hero_typed_words,
        kasir_script_url: form.kasir_script_url,
        kasir_script_key: form.kasir_script_key,
      })
      .eq("id", 1);

    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: "Gagal menyimpan: " + error.message });
    } else {
      setMessage({ type: "ok", text: "Pengaturan berhasil disimpan." });
    }
  }

  return (
    <DashboardLayout title="Pengaturan">
      <div className="setup-banner" style={{ display: "flex", background: "#E8F1FC", border: "1px solid #B3DBFF" }}>
        <div className="setup-ic">ℹ️</div>
        <div>
          <b style={{ color: "var(--brand-deep)" }}>Perubahan Ambang Batas Stok berlaku otomatis</b>
          <p style={{ color: "var(--brand-deep)" }}>
            Angka ini dipakai di halaman Stok Barang &amp; Dashboard untuk menentukan status &quot;Menipis&quot;. Profil Toko di bawah ini
            (WhatsApp, alamat, jam operasional, metode pembayaran) juga otomatis tersambung ke footer &amp; hero website tanikuagro.com.
          </p>
        </div>
      </div>

      {message && (
        <div
          className="setup-banner"
          style={{
            display: "flex",
            background: message.type === "ok" ? "var(--sage-soft)" : "var(--rust-soft)",
            border: `1px solid ${message.type === "ok" ? "var(--sage)" : "var(--rust)"}`,
          }}
        >
          <div className="setup-ic">{message.type === "ok" ? "✅" : "⚠️"}</div>
          <div>
            <b style={{ color: message.type === "ok" ? "var(--sage)" : "var(--rust)" }}>{message.text}</b>
          </div>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h3>📊 Ambang Batas Stok</h3></div>
          <div className="field" style={{ maxWidth: 280 }}>
            <label>Status &quot;Menipis&quot; jika stok kurang dari atau sama dengan</label>
            <input
              type="number"
              min="0"
              value={form.stok_minimum}
              disabled={loading}
              onChange={(e) => setForm({ ...form, stok_minimum: e.target.value })}
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 12, marginBottom: 0 }}>
            Status &quot;Habis&quot; selalu berlaku otomatis jika stok bernilai 0 atau kosong. Berlaku sama untuk semua produk.
          </p>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h3>💰 Tampilan Harga di Website</h3></div>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.show_real_price}
              disabled={loading}
              onChange={(e) => setForm({ ...form, show_real_price: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Tampilkan harga asli di tanikuagro.com</span>
          </label>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10, marginBottom: 0 }}>
            Kalau dimatikan (belum dicentang), website hanya menampilkan format seperti &quot;Rp XX.XXX&quot; — bukan harga sebenarnya.
            Kamu bisa nyalakan/matikan ini kapan saja tanpa perlu ubah kode. Harga tiap produk diatur di halaman Master Produk.
          </p>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h3>✍️ Teks Hero Beranda</h3></div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Judul Utama</label>
            <textarea
              rows={2}
              value={form.hero_heading}
              disabled={loading}
              onChange={(e) => setForm({ ...form, hero_heading: e.target.value })}
              placeholder="Sarana Pertanian Terlengkap, dari Taniku Agro untuk petani"
              style={{ border: "1.5px solid var(--slate200)", borderRadius: 10, padding: "11px 13px", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
            />
            <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6 }}>
              Kata terakhir setelah kalimat ini akan muncul otomatis bergantian (diatur di kolom di bawah) — tidak perlu ditulis di sini.
              Tulisan &quot;Taniku Agro&quot; akan otomatis tampil dengan warna aksen kalau ditulis persis begitu.
            </p>
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Kata yang Bergantian (pisahkan dengan koma)</label>
            <input
              type="text"
              value={form.hero_typed_words}
              disabled={loading}
              onChange={(e) => setForm({ ...form, hero_typed_words: e.target.value })}
              placeholder="Hebat, Maju, Tangguh, Sejahtera"
            />
            <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6 }}>
              Kata-kata ini akan muncul bergantian dengan efek mengetik di akhir judul. Boleh 1 kata atau lebih, pisahkan dengan koma.
            </p>
          </div>
          <div className="field">
            <label>Deskripsi di Bawah Judul</label>
            <textarea
              rows={3}
              value={form.hero_lede}
              disabled={loading}
              onChange={(e) => setForm({ ...form, hero_lede: e.target.value })}
              placeholder="Herbisida, fungisida, insektisida, dan kebutuhan tani lainnya..."
              style={{ border: "1.5px solid var(--slate200)", borderRadius: 10, padding: "11px 13px", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h3>🧾 Sinkronisasi Kasir</h3></div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>URL Google Apps Script</label>
            <input
              type="text"
              value={form.kasir_script_url}
              disabled={loading}
              onChange={(e) => setForm({ ...form, kasir_script_url: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
            />
          </div>
          <div className="field">
            <label>Kata Kunci (API Key)</label>
            <input
              type="text"
              value={form.kasir_script_key}
              disabled={loading}
              onChange={(e) => setForm({ ...form, kasir_script_key: e.target.value })}
              placeholder="tanikuagro"
            />
          </div>
          <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 10, marginBottom: 0 }}>
            Ini menghubungkan halaman Kasir ke sheet DAFTAR BARANG &amp; DATA PENJUALAN kamu lewat Google Apps Script. Cukup diisi sekali, berlaku buat semua perangkat.
          </p>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h3>🏪 Profil Toko</h3></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field">
              <label>Nama Toko</label>
              <input value={form.nama_toko} disabled={loading} onChange={(e) => setForm({ ...form, nama_toko: e.target.value })} />
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input value={form.whatsapp} disabled={loading} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Alamat</label>
              <input value={form.alamat} disabled={loading} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
            </div>
            <div className="field">
              <label>Jam Operasional</label>
              <input value={form.jam_operasional} disabled={loading} onChange={(e) => setForm({ ...form, jam_operasional: e.target.value })} />
            </div>
            <div className="field">
              <label>Metode Pembayaran</label>
              <input value={form.metode_pembayaran} disabled={loading} onChange={(e) => setForm({ ...form, metode_pembayaran: e.target.value })} />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading || saving} style={{ padding: "12px 24px" }}>
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </form>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>👤 Manajemen Pengguna</h3>
          <button type="button" className="btn-add" onClick={() => setShowAddUser(!showAddUser)}>
            {showAddUser ? "Batal" : "+ Tambah Pengguna"}
          </button>
        </div>

        {userMsg && (
          <div
            style={{
              padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14,
              background: userMsg.type === "ok" ? "var(--sage-soft)" : "var(--rust-soft)",
              color: userMsg.type === "ok" ? "var(--sage)" : "var(--rust)",
            }}
          >
            {userMsg.text}
          </div>
        )}

        {showAddUser && (
          <form onSubmit={handleAddUser} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Email</label>
                <input type="email" required value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="staf@tanikuagro.com" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Password Awal</label>
                <input type="text" required minLength={6} value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Minimal 6 karakter" />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Halaman yang boleh diakses (centang minimal 1 — kosong berarti akun tidak bisa akses halaman apa pun)</label>
              <PageChecklist selected={newUserPages} onChange={setNewUserPages} />
            </div>

            <button type="submit" className="btn-primary" disabled={addingUser} style={{ height: 42 }}>
              {addingUser ? "Menambah..." : "Tambah Pengguna"}
            </button>
          </form>
        )}

        <table>
          <thead>
            <tr><th>Email</th><th>Akses</th><th>Login Terakhir</th><th style={{ width: 150 }}>Aksi</th></tr>
          </thead>
          <tbody>
            {usersLoading && <tr><td colSpan={4} className="loading-row">Memuat...</td></tr>}
            {!usersLoading && users.length === 0 && <tr><td colSpan={4} className="empty-row">Belum ada pengguna.</td></tr>}
            {!usersLoading && users.map((u) => (
              <tr key={u.id}>
                <td className="prod-name">{u.email}</td>
                <td style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {Array.isArray(u.allowed_pages)
                    ? (u.allowed_pages.length === 0 ? "Tidak ada akses" : u.allowed_pages.map((k) => ACCESS_PAGES.find((p) => p.key === k)?.label || k).join(", "))
                    : "Owner (akses penuh)"}
                </td>
                <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("id-ID") : "Belum pernah login"}</td>
                <td>
                  <button className="btn-edit" onClick={() => openEditAccess(u)}>Edit Akses</button>
                  <button className="btn-delete" onClick={() => handleDeleteUser(u.id, u.email)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-lbl" style={{ marginTop: 32 }}>Lainnya</div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>🔗 Koneksi Data</h3></div>
        <table>
          <thead>
            <tr><th>Halaman</th><th>Sumber Data</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="prod-name">Master Produk</td>
              <td>Database Supabase</td>
              <td><span className="status-badge status-aman">✓ Terhubung</span></td>
            </tr>
            <tr>
              <td className="prod-name">Pengaturan</td>
              <td>Database Supabase</td>
              <td><span className="status-badge status-aman">✓ Terhubung</span></td>
            </tr>
            <tr>
              <td className="prod-name">Stok Barang</td>
              <td>Google Sheets — DAFTAR BARANG</td>
              <td><span className="status-badge status-aman">✓ Terhubung</span></td>
            </tr>
            <tr>
              <td className="prod-name">Stok Masuk</td>
              <td>Google Sheets — RESTOK BARANG</td>
              <td><span className="status-badge status-aman">✓ Terhubung</span></td>
            </tr>
            <tr>
              <td className="prod-name">Stok Keluar / Penjualan</td>
              <td>Google Sheets — DATA PENJUALAN</td>
              <td><span className="status-badge status-aman">✓ Terhubung</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>🚧 Fitur Mendatang</h3></div>
        <table>
          <tbody>
            <tr><td className="prod-name" style={{ width: 220 }}>Notifikasi Otomatis (WA/Email)</td><td><span className="status-badge status-menipis">Segera Hadir</span></td></tr>
            <tr><td className="prod-name">Laporan Gabungan</td><td><span className="status-badge status-menipis">Segera Hadir</span></td></tr>
          </tbody>
        </table>
      </div>

      {confirmAction && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h2 style={{ marginBottom: 0 }}>🔒 Konfirmasi Password</h2>
              <button
                type="button"
                disabled={confirming}
                onClick={() => setConfirmAction(null)}
                aria-label="Tutup"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--slate500)", display: "flex" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 18 }}>
              {confirmAction.type === "add" && `Masukkan password kamu untuk menambahkan akun ${confirmAction.payload.email}.`}
              {confirmAction.type === "delete" && `Masukkan password kamu untuk menghapus akun ${confirmAction.payload.email}.`}
              {confirmAction.type === "editAccess" && `Masukkan password kamu untuk menyimpan perubahan akses ${confirmAction.payload.email}.`}
            </p>

            <form className="modal-form" onSubmit={handleConfirmPassword}>
              {confirmError && <div className="error-msg">{confirmError}</div>}

              <div className="field">
                <label>Password Kamu</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" disabled={confirming} onClick={() => setConfirmAction(null)}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={confirming}
                  style={confirmAction.type === "delete" ? { background: "var(--rust)" } : {}}
                >
                  {confirming
                    ? "Memverifikasi..."
                    : confirmAction.type === "add"
                    ? "Konfirmasi & Tambah"
                    : confirmAction.type === "editAccess"
                    ? "Konfirmasi & Simpan"
                    : "Konfirmasi & Hapus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingAccessUser && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h2 style={{ marginBottom: 0 }}>Edit Akses — {editingAccessUser.email}</h2>
              <button
                type="button"
                disabled={savingAccess}
                onClick={() => setEditingAccessUser(null)}
                aria-label="Tutup"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--slate500)", display: "flex", flexShrink: 0 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 18 }}>
              Centang minimal 1 halaman. Kosong berarti akun ini tidak bisa akses halaman apa pun (login tapi mentok).
            </p>
            <PageChecklist selected={editPages} onChange={setEditPages} />
            <div className="modal-actions" style={{ marginTop: 18 }}>
              <button type="button" className="btn-cancel" disabled={savingAccess} onClick={() => setEditingAccessUser(null)}>
                Batal
              </button>
              <button type="button" className="btn-primary" disabled={savingAccess} onClick={handleSaveAccess}>
                {savingAccess ? "Menyimpan..." : "Simpan Akses"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function PageChecklist({ selected, onChange }) {
  function toggle(key) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", background: "var(--paper)", borderRadius: 10, padding: 14 }}>
      {ACCESS_PAGES.map((p) => (
        <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={selected.includes(p.key)} onChange={() => toggle(p.key)} />
          {p.label}
        </label>
      ))}
    </div>
  );
}
