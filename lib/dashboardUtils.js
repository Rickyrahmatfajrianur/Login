import Papa from "papaparse";

export const CSV_URLS = {
  stok: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFAW59sO9oG4SuLeQJFe2i9zsSZXxOZ_tT5aXkhkQekJ4dlHrpSyqvm5CLf-AsgHhYzC1hW7n7xFH1/pub?gid=1024901898&single=true&output=csv",
  restok: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFAW59sO9oG4SuLeQJFe2i9zsSZXxOZ_tT5aXkhkQekJ4dlHrpSyqvm5CLf-AsgHhYzC1hW7n7xFH1/pub?gid=1530203111&single=true&output=csv",
  penjualan: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFAW59sO9oG4SuLeQJFe2i9zsSZXxOZ_tT5aXkhkQekJ4dlHrpSyqvm5CLf-AsgHhYzC1hW7n7xFH1/pub?gid=1935134078&single=true&output=csv",
};

export const DEFAULT_STOK_MIN = 5;

// Ambil pengaturan (ambang batas stok, profil toko) dari Supabase
export async function fetchSettings(supabase) {
  try {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (error || !data) return null;
    return data;
  } catch (err) {
    console.warn("Gagal ambil pengaturan:", err);
    return null;
  }
}

export const CATEGORY_MAP = {
  "prima-laris": "herbisida", gisentro: "herbisida", atradex: "herbisida", cornelia: "herbisida",
  tandem: "fungisida", abacel: "insektisida", emacel: "insektisida", score: "fungisida",
  prevathon: "insektisida", amistartop: "fungisida", stadium: "insektisida", curacron: "insektisida",
  decis: "insektisida", demolish: "insektisida", glufo: "herbisida", roundup: "herbisida",
  bentop: "herbisida", gempur: "herbisida", gramoxone: "herbisida", dosdet: "zpt", ultradap: "pupuk",
  dangke: "insektisida", regent: "insektisida", marshal: "insektisida", antracol: "fungisida",
  matador: "insektisida", topsin: "fungisida", mipcinta: "insektisida", toxedown: "insektisida",
  starlon: "herbisida", garlon: "herbisida", kresna: "herbisida", gibas: "herbisida",
  grasso: "herbisida", jump: "herbisida", em4: "lainnya", vampyr: "insektisida", rumpas: "herbisida",
  kayabas: "herbisida", santrel: "zpt", supremo: "herbisida", ok: "herbisida", bio: "herbisida",
  mkp: "pupuk", vikar: "zpt", agus: "insektisida", macan: "herbisida", basis: "herbisida",
  wp: "zpt", meurtieur: "insektisida", tigatop: "herbisida", sofia: "herbisida", ulate: "insektisida",
  rambo: "herbisida", power: "pupuk", primazeb: "fungisida", bion: "fungisida",
};

export const CATEGORY_LABELS = {
  herbisida: "Herbisida", fungisida: "Fungisida", insektisida: "Insektisida", akarisida: "Akarisida",
  nematisida: "Nematisida", moluskisida: "Moluskisida", rodentisida: "Rodentisida", bakterisida: "Bakterisida",
  zpt: "ZPT", perekat: "Perekat & Surfaktan", pupuk: "Pupuk", benih: "Benih", biopestisida: "Biopestisida",
  alat: "Alat Pertanian", sparepart: "Spare Part", lainnya: "Lainnya",
};

export function guessCategory(namaBarang) {
  const firstWord = (namaBarang || "").trim().split(/\s+/)[0].toLowerCase();
  const cat = CATEGORY_MAP[firstWord];
  return cat ? CATEGORY_LABELS[cat] : "-";
}

export function computeStatus(stok, stokMin) {
  const s = parseFloat(stok);
  const min = parseFloat(stokMin) || DEFAULT_STOK_MIN;
  if (isNaN(s) || s <= 0) return "habis";
  if (s <= min) return "menipis";
  return "aman";
}

export function findHeaderRow(rows, requiredCols) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => (c || "").toString().trim().toLowerCase());
    if (requiredCols.every((col) => row.includes(col))) return i;
  }
  return -1;
}

export async function fetchCsvRows(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Status " + res.status);
  const text = await res.text();
  const result = Papa.parse(text, { header: false, skipEmptyLines: false });
  return result.data || [];
}

export function formatRupiah(n) {
  const num = parseFloat(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

export function formatRupiahShort(n) {
  const num = parseFloat(n) || 0;
  if (num >= 1000000) return "Rp " + (num / 1000000).toFixed(1) + "jt";
  if (num >= 1000) return "Rp " + (num / 1000).toFixed(0) + "rb";
  return "Rp " + num.toLocaleString("id-ID");
}

export function parseTanggalToDate(val) {
  if (!val) return null;
  const str = val.toString().trim();
  if (!str) return null;

  // 1. Serial number Google Sheets/Excel (misal 46256)
  const num = parseFloat(str);
  if (!isNaN(num) && num > 20000 && num < 90000 && /^[0-9.]+$/.test(str)) {
    return new Date((num - 25569) * 86400 * 1000);
  }

  // 2. Format DD/MM/YYYY atau DD-MM-YYYY (umum dipakai kalau tanggal diketik manual)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    let [, d, m, y] = dmyMatch;
    d = parseInt(d, 10);
    m = parseInt(m, 10);
    y = parseInt(y, 10);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const parsed = new Date(y, m - 1, d);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // 3. Fallback: coba parsing bawaan JavaScript (buat format yang sudah baku, misal "2026-08-30")
  const d2 = new Date(str);
  return isNaN(d2.getTime()) ? null : d2;
}

export function formatTanggal(val, short = false) {
  const d = parseTanggalToDate(val);
  if (!d) return "-";
  return d.toLocaleDateString("id-ID", short ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRupiahPenuh(n) {
  const num = parseFloat(n) || 0;
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

// Parsing angka yang tahan format Indonesia (titik = ribuan) MAUPUN format polos (tanpa titik).
// Contoh: "50.000" -> 50000, "1.234.567" -> 1234567, "50000" -> 50000, "50.5" -> 50.5 (desimal asli tetap aman)
export function parseAngkaIndonesia(val) {
  if (val === null || val === undefined || val === "") return 0;
  let str = val.toString().trim().replace(/[^0-9.,-]/g, "");
  if (str === "") return 0;

  if (str.includes(",")) {
    // Format Indonesia lengkap: titik = ribuan, koma = desimal (misal "50.000,50")
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = str.split(".");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      // Pola pemisah ribuan (tiap segmen setelah titik pertama = 3 digit) -> hapus semua titik
      str = str.replace(/\./g, "");
    }
    // Kalau bukan pola ribuan (misal "50.5"), biarkan sebagai desimal biasa
  }
  return parseFloat(str) || 0;
}

// Ubah kumpulan titik [x,y] jadi path SVG melengkung halus (Catmull-Rom -> Bezier)
export function catmullRomPath(points, tension = 0.3, maxY = null) {
  if (points.length < 2) return "";
  let path = `M${points[0][0]},${points[0][1]} `;
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 < n ? points[i + 2] : p2;
    const cp1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 3;
    let cp1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 3;
    const cp2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 3;
    let cp2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 3;
    // Cegah kurva "meleyot" ke bawah garis 0 (dasar chart) saat ada lonjakan tajam
    if (maxY !== null) {
      cp1y = Math.min(cp1y, maxY);
      cp2y = Math.min(cp2y, maxY);
    }
    path += `C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0]},${p2[1]} `;
  }
  return path.trim();
}

// Bulatkan nilai maksimum ke angka "rapi" buat skala sumbu Y (misal 17.3jt -> 20jt)
export function niceMaxScale(maxValue) {
  if (maxValue <= 0) return 1000000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / magnitude;
  let niceNormalized;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}
