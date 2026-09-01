"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasAccess } from "@/lib/permissions";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/ringkasan", key: "ringkasan", label: "Dashboard", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { href: "/kasir", key: "kasir", label: "Kasir", icon: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0" },
  { href: "/produk", key: "produk", label: "Master Produk", icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  { href: "/stok-barang", key: "stok-barang", label: "Stok Barang", icon: "M20 7h-9M14 17H5M17 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" },
  { href: "/restok", key: "restok", label: "Stok Masuk", icon: "M12 5v14M19 12l-7 7-7-7" },
  { href: "/penjualan", key: "penjualan", label: "Stok Keluar / Penjualan", icon: "M12 19V5M5 12l7-7 7 7" },
  { href: "/supplier", key: "supplier", label: "Supplier", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/laporan", key: "laporan", label: "Laporan", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
  { href: "/pengaturan", key: "pengaturan", label: "Pengaturan", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [allowedPages, setAllowedPages] = useState(null); // null = belum dicek / pemilik
  const [permLoaded, setPermLoaded] = useState(false); // true setelah data user selesai diambil
  const [email, setEmail] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    setCollapsed(saved === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || "");
        setAllowedPages(Array.isArray(user.app_metadata?.allowed_pages) ? user.app_metadata.allowed_pages : null);
      }
      setPermLoaded(true);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Sebelum permLoaded, jangan tampilkan menu apa pun dulu — daripada sempat
  // menampilkan semua menu (termasuk yang harusnya dibatasi) sesaat sebelum
  // izin akses akun ini selesai diperiksa.
  const visibleItems = permLoaded ? NAV_ITEMS.filter((item) => hasAccess(allowedPages, item.key)) : [];

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setOpen(true)} aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
      {open && <div className="sidebar-overlay open" onClick={() => setOpen(false)} />}

      <button
        className={`sidebar-collapse-handle ${collapsed ? "collapsed" : ""}`}
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Tampilkan menu" : "Sembunyikan menu"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
        </svg>
      </button>

      <aside className={`dash-sidebar ${open ? "open" : ""} ${collapsed ? "desktop-collapsed" : ""}`}>
        <div className="sidebar-brand">
          <img src="https://tanikuagro.com/images/logo.webp" alt="Taniku Agro" />
        </div>

        <nav className="side-nav">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{email ? email[0].toUpperCase() : "R"}</div>
          <div className="txt">
            <b>Taniku Agro</b>
            <span>{allowedPages ? "Karyawan" : "Owner"}</span>
          </div>
        </div>
        <ThemeToggle />
        <button className="btn-logout-sidebar" onClick={handleLogout}>
          Keluar
        </button>
      </aside>
    </>
  );
}
