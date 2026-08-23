import { createClient } from "@supabase/supabase-js";

// PENTING: file ini HANYA boleh dipakai di dalam API route (app/api/...),
// TIDAK PERNAH di komponen "use client". Kunci service_role di sini
// bisa akses seluruh database tanpa batasan apa pun.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
