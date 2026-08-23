import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Pastikan yang memanggil API ini sudah login sebelum lanjut
async function requireAuth() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));

  return NextResponse.json({ users });
}

export async function POST(request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
}

export async function DELETE(request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("id");

  if (!targetId) return NextResponse.json({ error: "ID pengguna tidak ditemukan" }, { status: 400 });
  if (targetId === user.id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri yang sedang login" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
