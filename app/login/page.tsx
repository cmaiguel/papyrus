"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { isSupabaseConfigured } from "@/lib/persistence";

const DEMO_EMAIL    = "papyrus@corello.ai";
const DEMO_PASSWORD = "corello123";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        // ── Supabase Auth ──────────────────────────────────────────────────
        const { createSupabaseClient } = await import("@/lib/supabase/client");
        const supabase = createSupabaseClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) {
          setError(authError.message);
          setLoading(false);
          return;
        }
      } else {
        // ── Demo mode (no Supabase) ────────────────────────────────────────
        await new Promise((r) => setTimeout(r, 800));
        if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
          setError("Invalid credentials. Use papyrus@corello.ai / corello123");
          setLoading(false);
          return;
        }
      }

      router.push("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#1A202C] overflow-hidden">
      {/* Blueprint grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(245,200,0,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,200,0,1) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glowing orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#F5C800]/5 blur-[120px] pointer-events-none" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo area */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-6 relative w-52 h-16">
            <Image
              src="/corello-logo-dark.png"
              alt="Corello"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Papyrus <span className="text-[#F5C800]">by Corello</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 tracking-widest uppercase">
              Manufacturing Intelligence System
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#232B38] border border-white/10 rounded-2xl p-8 shadow-2xl">
          <p className="text-slate-400 text-sm text-center mb-6">
            Sign in to your workspace
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="papyrus@corello.ai"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg bg-[#1A202C] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-[#F5C800]/60 focus:ring-1 focus:ring-[#F5C800]/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg bg-[#1A202C] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-[#F5C800]/60 focus:ring-1 focus:ring-[#F5C800]/30 transition-all"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-lg bg-[#F5C800] text-[#0f1117] font-bold text-sm tracking-wide hover:bg-[#FFD700] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#0f1117]/30 border-t-[#0f1117] rounded-full animate-spin" />
                  Authenticating…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-6 pt-5 border-t border-white/8">
            <p className="text-xs text-slate-500 text-center mb-2">Demo credentials</p>
            <button
              type="button"
              onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); }}
              className="w-full text-xs text-[#F5C800]/70 hover:text-[#F5C800] font-mono bg-[#1A202C] rounded-lg px-3 py-2 hover:bg-[#F5C800]/5 transition-all text-center border border-white/5"
            >
              papyrus@corello.ai / corello123
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Papyrus by Corello · AI Manufacturing Intelligence
        </p>
      </div>
    </div>
  );
}
