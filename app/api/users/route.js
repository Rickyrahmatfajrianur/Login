import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Pastikan yang memanggil API ini sudah login DAN punya izin akses "pengaturan"
async function requireAuth() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const allowedPages = user.app_metadata?.allowed_pages;
  const isOwner = !Array.isArray(allowedPages); // pemilik = tidak dibatasi
  const canManageUsers = isOwner || allowedPages.includes("pengaturan");

  return canManageUsers ? user : null;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    allowed_pages: Array.isArray(u.app_metadata?.allowed_pages) ? u.app_metadata.allowed_pages : null,
  }));

  return NextResponse.json({ users });
}

export async function POST(request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });

  const body = await request.json();
  const { email, password, allowedPages } = body;

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
    app_metadata: Array.isArray(allowedPages) ? { allowed_pages: allowedPages } : {},
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
}

export async function PATCH(request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });

  const body = await request.json();
  const { id, allowedPages } = body;

  if (!id) return NextResponse.json({ error: "ID pengguna tidak ditemukan" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    app_metadata: { allowed_pages: Array.isArray(allowedPages) ? allowedPages : null },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });

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
