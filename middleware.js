import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  // Rute /api/* mengurus otentikasinya masing-masing (lihat requireAuth() di
  // app/api/users/route.js dan verifikasi CRON_SECRET di app/api/keepalive/route.js).
  // JANGAN di-redirect ke /login di sini — kalau tidak, request tanpa sesi login
  // (misalnya panggilan Vercel Cron ke /api/keepalive) malah kena redirect duluan
  // dan handler API-nya nggak pernah kejalanin sama sekali.
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Belum login & bukan di halaman login -> lempar ke halaman login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Sudah login tapi masih di halaman login -> lempar ke Dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/ringkasan";
    return NextResponse.redirect(url);
  }

  // ===== Cek izin akses per halaman (kalau akun ini dibatasi) =====
  if (user && !isLoginPage) {
    const allowedPages = user.app_metadata?.allowed_pages; // undefined = pemilik, akses penuh
    if (Array.isArray(allowedPages)) {
      const pathSegment = request.nextUrl.pathname.split("/")[1];
      if (pathSegment && !allowedPages.includes(pathSegment)) {
        const url = request.nextUrl.clone();
        url.pathname = "/" + (allowedPages[0] || "produk");
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
