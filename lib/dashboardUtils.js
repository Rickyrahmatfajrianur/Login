import Papa from "papaparse";

export const CSV_URLS = {
  stok: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFAW59sO9oG4SuLeQJFe2i9zsSZXxOZ_tT5aXkhkQekJ4dlHrpSyqvm5CLf-AsgHhYzC1hW7n7xFH1/pub?gid=1024901898&single=true&output=csv",
  restok: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFAW59sO9oG4SuLeQJFe2i9zsSZXxOZ_tT5aXkhkQekJ4dlHrpSyqvm5CLf-AsgHhYzC1hW7n7xFH1/pub?gid=1530203111&single=true&output=csv",
  penjualan: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFAW59sO9oG4SuLeQJFe2i9zsSZXxOZ_tT5aXkhkQekJ4dlHrpSyqvm5CLf-AsgHhYzC1hW7n7xFH1/pub?gid=1935134078&single=true&output=csv",
};

export const DEFAULT_STOK_MIN = 5;

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
  const num = parseFloat(val);
  if (!isNaN(num) && num > 20000 && num < 90000) {
    return new Date((num - 25569) * 86400 * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTanggal(val, short = false) {
  const d = parseTanggalToDate(val);
  if (!d) return "-";
  return d.toLocaleDateString("id-ID", short ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "numeric" });
}
