"use client";

import DashboardLayout from "@/components/DashboardLayout";

export default function PengaturanPage() {
  return (
    <DashboardLayout title="Pengaturan">
      <div className="setup-banner" style={{ display: "flex" }}>
        <div className="setup-ic">👁️</div>
        <div>
          <b>Halaman ini hanya untuk melihat (read-only)</b>
          <p>Untuk mengubah pengaturan di bawah ini, hubungi pengembang website atau edit langsung di sumber datanya.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>🏪 Profil Toko</h3></div>
        <table>
          <tbody>
            <tr><td style={{ width: 200, color: "#64748B" }}>Nama Toko</td><td className="prod-name">Taniku Agro</td></tr>
            <tr><td style={{ color: "#64748B" }}>Alamat</td><td>Desa Rintik RT.003, Kec. Babulu, Penajam Paser Utara, Kalimantan Timur</td></tr>
            <tr><td style={{ color: "#64748B" }}>Jam Operasional</td><td>06.00 – 21.00 WITA (Setiap hari)</td></tr>
            <tr><td style={{ color: "#64748B" }}>WhatsApp</td><td>0851-5721-5526</td></tr>
            <tr><td style={{ color: "#64748B" }}>Metode Pembayaran</td><td>Tunai · Transfer · QRIS</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>📊 Ambang Batas Stok</h3></div>
        <table>
          <tbody>
            <tr><td style={{ width: 200, color: "#64748B" }}>Status &quot;Menipis&quot; jika stok ≤</td><td className="stok-val">5</td></tr>
            <tr><td style={{ color: "#64748B" }}>Status &quot;Habis&quot; jika stok</td><td className="stok-val">0 atau kosong</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "#8B9AA8", marginTop: 12 }}>
          Berlaku sama untuk semua produk. Belum bisa diatur berbeda per produk.
        </p>
      </div>

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
            <tr><td className="prod-name">Manajemen Pengguna</td><td><span className="status-badge status-menipis">Segera Hadir</span></td></tr>
            <tr><td className="prod-name">Laporan Gabungan</td><td><span className="status-badge status-menipis">Segera Hadir</span></td></tr>
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
