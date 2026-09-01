"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import {
  getKasirProducts,
  saveKasirProducts,
  getKasirTransactions,
  saveKasirTransactions,
  formatRupiahKasir,
  formatAngkaKasir,
  slugIdKasir,
} from "@/lib/kasirStorage";

export default function KasirPage() {
  const supabase = createClient();

  const [scriptUrl, setScriptUrl] = useState("");
  const [scriptKey, setScriptKey] = useState("");
  const [online, setOnline] = useState(false);
  const [screen, setScreen] = useState("penjualan"); // 'penjualan' | 'dashboard' | 'riwayat'

  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("Semua");
  const [keyword, setKeyword] = useState("");
  const [flashId, setFlashId] = useState(null);

  const [cart, setCart] = useState({}); // { [nama]: { harga, qty } }
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState("");

  const [receipt, setReceipt] = useState(null); // trx terakhir, buat ditampilkan
  const [voidTarget, setVoidTarget] = useState(null); // { trxId, itemIndex }
  const [toasts, setToasts] = useState([]);

  const settingsLoaded = useRef(false);

  // ===== Ambil pengaturan sinkron dari Supabase =====
  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.from("settings").select("kasir_script_url, kasir_script_key").eq("id", 1).single();
      if (data) {
        setScriptUrl(data.kasir_script_url || "");
        setScriptKey(data.kasir_script_key || "");
      }
      settingsLoaded.current = true;
    }
    loadSettings();
    setProducts(getKasirProducts());
  }, []);

  useEffect(() => {
    if (!settingsLoaded.current) return;
    if (!scriptUrl || !scriptKey) return;
    cobaSinkron();
    const interval = setInterval(cobaSinkron, 30000);
    return () => clearInterval(interval);
  }, [scriptUrl, scriptKey]);

  function showToast(pesan) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, pesan }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }

  // ===== Sinkronisasi =====
  async function cobaSinkron() {
    if (!scriptUrl || !scriptKey) {
      setOnline(false);
      return;
    }
    try {
      const ping = await fetch(scriptUrl + "?key=" + encodeURIComponent(scriptKey) + "&ping=1");
      if (!ping.ok) throw new Error("gagal");
      setOnline(true);
      await tarikProduk();
      await kirimTransaksiTertunda();
    } catch (err) {
      setOnline(false);
    }
  }

  async function tarikProduk() {
    try {
      const res = await fetch(scriptUrl + "?key=" + encodeURIComponent(scriptKey));
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        saveKasirProducts(data);
        setProducts(data);
      }
    } catch (err) {
      // biarkan, coba lagi di siklus berikutnya
    }
  }

  async function kirimTransaksiTertunda() {
    const list = getKasirTransactions();
    let berubah = false;
    for (const trx of list) {
      if (trx.status_sinkron === "tersinkron") continue;

      const itemUntukDikirim = trx.tipe === "void" ? trx.items : trx.items.filter((item) => item.status !== "dibatalkan");

      if (itemUntukDikirim.length === 0) {
        trx.status_sinkron = "tersinkron";
        berubah = true;
        continue;
      }

      try {
        const res = await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ ...trx, key: scriptKey, status: trx.status_toko || "LUNAS", items: itemUntukDikirim }),
        });
        if (res.ok) {
          trx.status_sinkron = "tersinkron";
          berubah = true;
        }
      } catch (err) {
        // coba lagi nanti
      }
    }
    if (berubah) saveKasirTransactions(list);
  }

  // ===== Produk & kategori =====
  const kategoriList = ["Semua", ...Array.from(new Set(products.map((p) => p.kategori || "Umum")))];

  const produkTampil = products
    .filter((p) => {
      const cocokKategori = category === "Semua" || (p.kategori || "Umum") === category;
      const cocokKeyword = !keyword || p.nama.toLowerCase().includes(keyword.trim().toLowerCase());
      return cocokKategori && cocokKeyword;
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  // Sisa stok yang boleh ditambahkan lagi ke keranjang (stok asli dikurangi yang sudah ada di keranjang).
  // Kalau produknya nggak ketemu (misal data belum sinkron), jangan dibatasi sama sekali.
  function sisaStokUntukKeranjang(nama) {
    const produk = products.find((p) => p.nama === nama);
    if (!produk) return Infinity;
    return produk.stok;
  }

  function tambahKeKeranjang(nama, harga) {
    const stokTersedia = sisaStokUntukKeranjang(nama);
    const qtyDiKeranjang = cart[nama]?.qty || 0;
    if (qtyDiKeranjang + 1 > stokTersedia) {
      showToast(`Stok ${nama} tinggal ${formatAngkaKasir(stokTersedia)}`);
      return;
    }

    setCart((prev) => {
      const next = { ...prev };
      if (!next[nama]) next[nama] = { harga, qty: 0 };
      else next[nama] = { ...next[nama] };
      next[nama].qty += 1;
      return next;
    });
    const id = slugIdKasir(nama);
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 500);
    showToast(nama + " ditambahkan");
  }

  function ubahQty(nama, delta) {
    const current = cart[nama];
    if (!current) return;
    const newQty = current.qty + delta;

    if (delta > 0) {
      const stokTersedia = sisaStokUntukKeranjang(nama);
      if (newQty > stokTersedia) {
        showToast(`Stok ${nama} tinggal ${formatAngkaKasir(stokTersedia)}`);
        return;
      }
    }

    setCart((prev) => {
      const next = { ...prev };
      if (newQty <= 0) {
        delete next[nama];
      } else {
        next[nama] = { ...next[nama], qty: newQty };
      }
      return next;
    });
  }

  const cartNames = Object.keys(cart);
  const subtotal = cartNames.reduce((sum, nama) => sum + cart[nama].harga * cart[nama].qty, 0);
  const diskonNum = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - diskonNum);
  const dibayarNum = Math.max(0, Number(payment) || 0);
  const kembalian = dibayarNum - total;

  function selesaikanTransaksi() {
    if (cartNames.length === 0) return;

    const items = cartNames.map((nama) => ({
      nama_produk: nama,
      qty: cart[nama].qty,
      harga_satuan: cart[nama].harga,
      subtotal: cart[nama].harga * cart[nama].qty,
      status: "aktif",
    }));

    const trx = {
      id: "trx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      waktu: new Date().toISOString(),
      customer: customer.trim(),
      subtotal,
      diskon: diskonNum,
      total,
      uang_dibayar: dibayarNum,
      kembalian, // bisa negatif = kurang bayar, disimpan apa adanya (jangan dibulatkan ke 0)
      status_sinkron: "belum_sinkron",
      items,
    };

    const list = getKasirTransactions();
    list.push(trx);
    saveKasirTransactions(list);

    const produkList = getKasirProducts();
    items.forEach((item) => {
      const p = produkList.find((pr) => pr.nama === item.nama_produk);
      if (p) p.stok -= item.qty;
    });
    saveKasirProducts(produkList);
    setProducts(produkList);

    setReceipt(trx);
    setCart({});
    setCustomer("");
    setDiscount("");
    setPayment("");
    cobaSinkron();
  }

  // ===== Riwayat (lokal, hari ini) =====
  const [, forceRerender] = useState(0);
  const todayTrx = getKasirTransactions()
    .filter((t) => {
      const d = new Date(t.waktu);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d >= startOfDay && t.tipe !== "void";
    })
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  const todayActiveTrx = todayTrx.filter((t) => t.status !== "dibatalkan");
  let omzetHariIni = 0;
  const produkMap = {};
  todayActiveTrx.forEach((trx) => {
    const itemAktif = trx.items.filter((item) => item.status !== "dibatalkan");
    const semuaAktif = itemAktif.length === trx.items.length;
    const subtotalAktif = itemAktif.reduce((sum, item) => sum + item.subtotal, 0);
    omzetHariIni += Math.max(0, subtotalAktif - (semuaAktif ? trx.diskon || 0 : 0));
    itemAktif.forEach((item) => {
      if (!produkMap[item.nama_produk]) produkMap[item.nama_produk] = { qty: 0, harga: item.harga_satuan, total: 0 };
      produkMap[item.nama_produk].qty += item.qty;
      produkMap[item.nama_produk].total += item.subtotal;
    });
  });
  let unitTerjual = 0;
  Object.values(produkMap).forEach((p) => (unitTerjual += p.qty));
  const namaProdukTerjual = Object.keys(produkMap).sort((a, b) => a.localeCompare(b));

  function bukaVoidModal(trxId, itemIndex) {
    setVoidTarget({ trxId, itemIndex });
  }

  function konfirmasiBatal(alasan) {
    if (!voidTarget) return;
    batalkanItemTransaksi(voidTarget.trxId, voidTarget.itemIndex, alasan);
    setVoidTarget(null);
  }

  function batalkanItemTransaksi(trxId, itemIndex, alasan) {
    const list = getKasirTransactions();
    const trx = list.find((t) => t.id === trxId);
    if (!trx) return;
    const item = trx.items[itemIndex];
    if (!item || item.status === "dibatalkan") return;

    item.status = "dibatalkan";
    item.alasan_batal = alasan;

    const produkList = getKasirProducts();
    const p = produkList.find((pr) => pr.nama === item.nama_produk);
    if (p) p.stok += item.qty;
    saveKasirProducts(produkList);
    setProducts(produkList);

    const semuaDibatalkan = trx.items.every((it) => it.status === "dibatalkan");
    if (semuaDibatalkan) trx.status = "dibatalkan";

    if (trx.status_sinkron === "tersinkron") {
      list.push({
        id: "void_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        waktu: new Date().toISOString(),
        tipe: "void",
        referensi_id: trx.id,
        customer: trx.customer || "",
        status_toko: alasan === "retur" ? "RETUR" : "BATAL",
        subtotal: 0,
        diskon: 0,
        total: 0,
        uang_dibayar: 0,
        kembalian: 0,
        status_sinkron: "belum_sinkron",
        items: [
          {
            nama_produk: item.nama_produk,
            qty: -item.qty,
            harga_satuan: item.harga_satuan,
            subtotal: -item.subtotal,
          },
        ],
      });
    }

    saveKasirTransactions(list);
    forceRerender((n) => n + 1);
    showToast(alasan === "retur" ? "Retur dicatat, stok dikembalikan" : "Produk dibatalkan");
    cobaSinkron();
  }

  function cetakStruk() {
    window.print();
  }

  return (
    <DashboardLayout
      title="Kasir"
      headerRight={
        <span className={`kasir-status ${online ? "online" : "offline"}`}>
          <span className="dot"></span>
          {online ? "Online" : "Offline"}
        </span>
      }
    >
      {(!scriptUrl || !scriptKey) && (
        <div className="setup-banner" style={{ display: "flex", marginBottom: 20 }}>
          <div className="setup-ic">⚠️</div>
          <div>
            <b>Sinkronisasi belum diatur</b>
            <p>
              Isi dulu URL &amp; kata kunci Google Apps Script di{" "}
              <Link href="/pengaturan" style={{ color: "var(--brand)", fontWeight: 700 }}>
                halaman Pengaturan
              </Link>{" "}
              supaya kasir bisa ambil data produk &amp; sinkron transaksi.
            </p>
          </div>
        </div>
      )}

      <div className="kasir-tabs">
        <button className={screen === "penjualan" ? "active" : ""} onClick={() => setScreen("penjualan")}>Penjualan</button>
        <button className={screen === "dashboard" ? "active" : ""} onClick={() => setScreen("dashboard")}>Dashboard</button>
        <button className={screen === "riwayat" ? "active" : ""} onClick={() => setScreen("riwayat")}>Riwayat</button>
      </div>

      {screen === "penjualan" && (
        <div className="kasir-layout">
          <div className="kasir-products-col">
            <div className="kasir-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Ketik nama produk..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </div>

            {kategoriList.length > 1 && (
              <div className="kasir-categories">
                {kategoriList.map((kat) => (
                  <div key={kat} className={`kasir-chip ${category === kat ? "active" : ""}`} onClick={() => setCategory(kat)}>
                    {kat}
                  </div>
                ))}
              </div>
            )}

            <div className="kasir-product-grid">
              {produkTampil.length === 0 && (
                <div className="kasir-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <span>Produk tidak ditemukan. Tambahkan lewat sheet &quot;DAFTAR BARANG&quot; lalu tunggu sinkron.</span>
                </div>
              )}
              {produkTampil.map((p) => {
                const qtyDiKeranjang = cart[p.nama]?.qty || 0;
                const habis = p.stok <= 0 || qtyDiKeranjang >= p.stok;
                const menipis = p.stok <= 5;
                return (
                  <div
                    key={p.nama}
                    className={`kasir-product-card ${habis ? "disabled" : ""}`}
                    onClick={() => !habis && tambahKeKeranjang(p.nama, p.harga)}
                  >
                    <span className={`kasir-add-flash ${flashId === slugIdKasir(p.nama) ? "show" : ""}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </span>
                    <div className="kasir-product-name">{p.nama}</div>
                    <div className={`kasir-product-stock ${menipis ? "low" : ""}`}>
                      Stok: {formatAngkaKasir(p.stok)} {p.satuan || ""}{menipis ? " - menipis" : ""}
                    </div>
                    <div className="kasir-product-price">{formatRupiahKasir(p.harga)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="kasir-cart-col">
            <div className="kasir-cart-head">
              Keranjang{cartNames.length > 0 && <span className="kasir-cart-count">{cartNames.reduce((s, n) => s + cart[n].qty, 0)}</span>}
            </div>
            <div className="kasir-cart-lines">
              {cartNames.length === 0 && <div className="kasir-cart-empty">Belum ada item</div>}
              {cartNames.map((nama) => (
                <div className="kasir-cart-line" key={nama}>
                  <span>{nama}</span>
                  <div className="kasir-cart-qty">
                    <button onClick={() => ubahQty(nama, -1)}>-</button>
                    <span>{cart[nama].qty}</span>
                    <button onClick={() => ubahQty(nama, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <input type="text" placeholder="Nama pelanggan (opsional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <input type="number" placeholder="Diskon" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>

            <div className="kasir-total-row">
              <span>Total</span>
              <b>{formatRupiahKasir(total)}</b>
            </div>

            <div className="field" style={{ marginTop: 8 }}>
              <input type="number" placeholder="Uang dibayar" value={payment} onChange={(e) => setPayment(e.target.value)} />
            </div>

            <div className={`kasir-change-row ${kembalian < 0 ? "negative" : ""}`}>
              <span>{kembalian < 0 ? "Kurang bayar" : "Kembalian"}</span>
              <b>{formatRupiahKasir(Math.abs(kembalian))}</b>
            </div>

            <button className="btn-primary" style={{ marginTop: 14, padding: 13 }} disabled={cartNames.length === 0} onClick={selesaikanTransaksi}>
              Selesaikan transaksi
            </button>
          </div>
        </div>
      )}

      {screen === "dashboard" && (
        <div>
          <div className="stat-row" style={{ marginBottom: 20 }}>
            <div className="stat-cell">
              <div className="lbl">Transaksi</div>
              <div className="val">{todayActiveTrx.length}</div>
            </div>
            <div className="stat-cell">
              <div className="lbl">Unit Terjual</div>
              <div className="val">{formatAngkaKasir(unitTerjual)}</div>
            </div>
            <div className="stat-cell accent">
              <div className="lbl">Omzet</div>
              <div className="val small">{formatRupiahKasir(omzetHariIni)}</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 14 }}>
            Ringkasan ini dari transaksi yang dibuat di perangkat ini hari ini. Buat ringkasan gabungan semua perangkat, cek{" "}
            <Link href="/ringkasan" style={{ color: "var(--brand)", fontWeight: 700 }}>halaman Dashboard</Link>.
          </p>
          <div className="panel">
            <div className="panel-head"><h3>Produk Terjual Hari Ini (Perangkat Ini)</h3></div>
            {namaProdukTerjual.length === 0 ? (
              <p className="empty-row">Belum ada transaksi hari ini.</p>
            ) : (
              <table>
                <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead>
                <tbody>
                  {namaProdukTerjual.map((nama) => (
                    <tr key={nama}>
                      <td className="prod-name">{nama}</td>
                      <td className="stok-val">{formatAngkaKasir(produkMap[nama].qty)}</td>
                      <td className="stok-val">{formatRupiahKasir(produkMap[nama].harga)}</td>
                      <td className="stok-val">{formatRupiahKasir(produkMap[nama].total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {screen === "riwayat" && (
        <div>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 14 }}>
            Riwayat di bawah ini khusus transaksi dari perangkat ini hari ini (buat proses batalkan/retur cepat). Buat riwayat lengkap dari semua perangkat, cek{" "}
            <Link href="/penjualan" style={{ color: "var(--brand)", fontWeight: 700 }}>halaman Stok Keluar / Penjualan</Link>.
          </p>
          {todayTrx.length === 0 ? (
            <p className="empty-row">Belum ada transaksi hari ini.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayTrx.map((trx) => {
                const waktu = new Date(trx.waktu);
                const jam = waktu.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div className="panel" key={trx.id} style={{ opacity: trx.status === "dibatalkan" ? 0.55 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 13 }}>
                        <b>{jam}</b>{trx.customer && <span style={{ color: "var(--ink-faint)" }}> · {trx.customer}</span>}
                      </div>
                      <b>{formatRupiahKasir(trx.total)}</b>
                    </div>
                    {trx.items.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--paper)" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, textDecoration: item.status === "dibatalkan" ? "line-through" : "none" }}>{item.nama_produk}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{item.qty} x {formatRupiahKasir(item.harga_satuan)} = {formatRupiahKasir(item.subtotal)}</div>
                        </div>
                        {item.status === "dibatalkan" ? (
                          <span className="status-badge status-menipis">{item.alasan_batal === "retur" ? "Retur" : "Dibatalkan"}</span>
                        ) : (
                          <button className="btn-delete" onClick={() => bukaVoidModal(trx.id, idx)}>Batalkan</button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== Modal struk ===== */}
      {receipt && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ marginBottom: 0 }}>Struk</h2>
              <button onClick={() => setReceipt(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div id="receipt-print" style={{ fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.6 }}>
              <div style={{ textAlign: "center", fontWeight: 700 }}>TANIKU AGRO</div>
              <div style={{ textAlign: "center" }}>Ds. Rintik, Kec. Babulu, PPU</div>
              <hr />
              <div>{new Date(receipt.waktu).toLocaleDateString("id-ID")} {new Date(receipt.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              {receipt.customer && <div>Pelanggan: {receipt.customer}</div>}
              <hr />
              {receipt.items.map((item, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <div>{item.nama_produk}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{item.qty} x {formatRupiahKasir(item.harga_satuan)}</span>
                    <span>{formatRupiahKasir(item.subtotal)}</span>
                  </div>
                </div>
              ))}
              <hr />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{formatRupiahKasir(receipt.subtotal)}</span></div>
              {receipt.diskon > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Diskon</span><span>-{formatRupiahKasir(receipt.diskon)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>TOTAL</span><span>{formatRupiahKasir(receipt.total)}</span></div>
              <hr />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tunai</span><span>{formatRupiahKasir(receipt.uang_dibayar)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{receipt.kembalian < 0 ? "Kurang Bayar" : "Kembali"}</span>
                <span>{formatRupiahKasir(Math.abs(receipt.kembalian))}</span>
              </div>
              <hr />
              <div style={{ textAlign: "center" }}>Terima kasih</div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setReceipt(null)}>Tutup</button>
              <button className="btn-primary" onClick={cetakStruk}>Cetak Struk</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal batalkan ===== */}
      {voidTarget && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h2>Batalkan transaksi</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>Pilih alasan pembatalan. Stok produk akan dikembalikan secara otomatis.</p>
            <button className="kasir-void-reason" onClick={() => konfirmasiBatal("kesalahan")}>
              Kesalahan input<small>Salah catat produk, jumlah, atau harga</small>
            </button>
            <button className="kasir-void-reason" onClick={() => konfirmasiBatal("retur")}>
              Retur dari pelanggan<small>Barang dikembalikan setelah transaksi selesai</small>
            </button>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setVoidTarget(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      <div className="kasir-toast-container">
        {toasts.map((t) => (
          <div className="kasir-toast" key={t.id}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span>{t.pesan}</span>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
