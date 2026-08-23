"use client";

import Sidebar from "./Sidebar";

export default function DashboardLayout({ title, tag = "Internal", headerRight, children }) {
  return (
    <div className="dash-app">
      <Sidebar />
      <div className="dash-body">
        <header className="dash-header">
          <div className="dash-header-left">
            <span className="dash-title">
              {title} <span className="dash-tag">{tag}</span>
            </span>
          </div>
          <div className="dash-header-right">{headerRight}</div>
        </header>
        <main className="dash-main">{children}</main>
        <footer className="dash-footer">
          <p>© 2026 Taniku Agro</p>
        </footer>
      </div>
    </div>
  );
}
