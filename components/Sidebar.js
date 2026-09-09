"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasAccess } from "@/lib/permissions";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/ringkasan", key: "ringkasan", label: "Dashboard", icon: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2" opacity="0.45"/><rect x="3" y="13" width="8" height="8" rx="2" opacity="0.45"/><rect x="13" y="13" width="8" height="8" rx="2"/>' },
  { href: "/kasir", key: "kasir", label: "Kasir", icon: '<path d="M4.5 8h15l-1.4 11.3A2 2 0 0 1 16.13 21H7.87a2 2 0 0 1-1.97-1.7L4.5 8Z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
  { href: "/produk", key: "produk", label: "Master Produk", icon: '<rect x="3" y="3" width="18" height="18" rx="4"/>' },
  { href: "/stok-barang", key: "stok-barang", label: "Stok Barang", icon: '<rect x="4" y="3" width="16" height="7.5" rx="2"/><rect x="4" y="13.5" width="16" height="7.5" rx="2" opacity="0.45"/>' },
  { href: "/restok", key: "restok", label: "Stok Masuk", icon: '<path d="M11 3h2v7h3.3L12 15.5 7.7 10H11V3Z"/><rect x="5" y="19" width="14" height="2" rx="1"/>' },
  { href: "/penjualan", key: "penjualan", label: "Stok Keluar / Penjualan", icon: '<path d="M13 21h-2v-7H7.7L12 8.5l4.3 5.5H13V21Z"/><rect x="5" y="3" width="14" height="2" rx="1"/>' },
  { href: "/invoice", key: "invoice", label: "Invoice", icon: '<rect x="7" y="2" width="10" height="20" rx="2"/>' },
  { href: "/supplier", key: "supplier", label: "Supplier", icon: '<rect x="2" y="9" width="13" height="8" rx="1.5"/><path d="M15 11h3.5l2.5 3v3h-6v-6Z"/><circle cx="6.5" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>' },
  { href: "/laporan", key: "laporan", label: "Laporan", icon: '<rect x="4" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="16" y="3" width="4" height="18" rx="1"/>' },
  { href: "/pengaturan", key: "pengaturan", label: "Pengaturan", icon: '<rect x="3" y="6" width="18" height="2" rx="1"/><circle cx="8" cy="7" r="2.5"/><rect x="3" y="16" width="18" height="2" rx="1"/><circle cx="16" cy="17" r="2.5"/>' },
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
              <svg viewBox="0 0 24 24" fill="currentColor" dangerouslySetInnerHTML={{ __html: item.icon }} />
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
