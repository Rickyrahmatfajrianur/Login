"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";

export default function PengaturanPage() {
  const [form, setForm] = useState({
    nama_toko: "", alamat: "", jam_operasional: "", whatsapp: "", metode_pembayaran: "", stok_minimum: 5,
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
  const [userMsg, setUserMsg] = useState(null);
  const [addingUser, setAddingUser] = useState(false);

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

  async function handleAddUser(e) {
    e.preventDefault();
    setAddingUser(true);
    setUserMsg(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUserMsg({ type: "error", text: data.error || "Gagal menambah pengguna." });
      } else {
        setUserMsg({ type: "ok", text: `Pengguna ${data.user.email} berhasil ditambahkan.` });
        setNewUserEmail("");
        setNewUserPassword("");
        setShowAddUser(false);
        loadUsers();
      }
    } catch (err) {
      setUserMsg({ type: "error", text: "Terjadi kesalahan. Coba lagi." });
    }
    setAddingUser(false);
  }

  async function handleDeleteUser(id, email) {
    if (!confirm(`Yakin ingin menghapus akun ${email}?`)) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setUserMsg({ type: "error", text: data.error || "Gagal menghapus pengguna." });
      } else {
        loadUsers();
      }
    } catch (err) {
      setUserMsg({ type: "error", text: "Terjadi kesalahan. Coba lagi." });
    }
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
            khusus untuk catatan internal &mdash; belum otomatis mengubah tampilan di website tanikuagro.com.
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
          <form onSubmit={handleAddUser} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label>Email</label>
              <input type="email" required value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="staf@tanikuagro.com" />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label>Password Awal</label>
              <input type="text" required minLength={6} value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Minimal 6 karakter" />
            </div>
            <button type="submit" className="btn-primary" disabled={addingUser} style={{ height: 42 }}>
              {addingUser ? "Menambah..." : "Tambah"}
            </button>
          </form>
        )}

        <table>
          <thead>
            <tr><th>Email</th><th>Login Terakhir</th><th style={{ width: 90 }}>Aksi</th></tr>
          </thead>
          <tbody>
            {usersLoading && <tr><td colSpan={3} className="loading-row">Memuat...</td></tr>}
            {!usersLoading && users.length === 0 && <tr><td colSpan={3} className="empty-row">Belum ada pengguna.</td></tr>}
            {!usersLoading && users.map((u) => (
              <tr key={u.id}>
                <td className="prod-name">{u.email}</td>
                <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("id-ID") : "Belum pernah login"}</td>
                <td>
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
    </DashboardLayout>
  );
}
