"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("Gagal login: " + error.message);
      return;
    }

    router.push("/ringkasan");
    router.refresh();
  }

  return (
    <div className="login-hero">
      <div
        className="login-hero-bg"
        style={{ backgroundImage: "url('https://tanikuagro.com/images/hero-bg.webp')" }}
      ></div>
      <div className="login-hero-overlay"></div>

      <div className="login-wrap">
        <div className="login-card">
          <h1>Login Admin</h1>
          <p className="sub">Taniku Agro — Panel Pengelolaan Produk</p>

          <form className="login-form" onSubmit={handleLogin}>
            {error && <div className="error-msg">{error}</div>}

            <div className="field">
              <label>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tanikuagro.com"
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
