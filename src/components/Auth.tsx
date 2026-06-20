"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Auth() {
  const supabase = createClient();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() || undefined },
          },
        });
        if (signUpError) throw signUpError;
        alert("Регистрация успешна! Теперь вы можете войти.");
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-nox-bg text-white p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-nox-panel p-6 shadow-xl">
        <h2 className="text-xl font-semibold tracking-tight text-center mb-6">
          {isSignUp ? "Создать аккаунт Nox" : "Войти в Nox"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignUp && (
            <div>
              <label className="block text-xs text-white/50 mb-1">Имя в чате</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-white/50 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
            />
          </div>

          {error && <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-white text-black py-2.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Секунду..." : isSignUp ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            {isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}