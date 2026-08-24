import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Dipanggil otomatis oleh Vercel Cron (lihat vercel.json).
// Tugasnya cuma satu: melakukan query ringan ke Supabase supaya dianggap
// "aktif" dan tidak di-pause otomatis karena 7 hari tanpa aktivitas.
export async function GET(request) {
  // Vercel Cron mengirim header ini otomatis — pastikan bukan dipanggil orang random
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { error } = await supabase.from("settings").select("id").eq("id", 1).single();
    if (error) throw error;

    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
