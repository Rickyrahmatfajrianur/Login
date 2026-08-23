"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/ringkasan", label: "Dashboard", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { href: "/produk", label: "Master Produk", icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  { href: "/stok-barang", label: "Stok Barang", icon: "M20 7h-9M14 17H5M17 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" },
  { href: "/restok", label: "Stok Masuk", icon: "M12 5v14M19 12l-7 7-7-7" },
  { href: "/penjualan", label: "Stok Keluar / Penjualan", icon: "M12 19V5M5 12l7-7 7 7" },
  { href: "/supplier", label: "Supplier", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/pengaturan", label: "Pengaturan", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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

      <aside className={`dash-sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="https://tanikuagro.com/images/logo.webp" alt="Taniku Agro" />
        </div>

        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
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
          <div className="avatar">R</div>
          <div className="txt">
            <b>Taniku Agro</b>
            <span>Owner</span>
          </div>
        </div>
        <button className="btn-logout-sidebar" onClick={handleLogout}>
          Keluar
        </button>
      </aside>
    </>
  );
}
