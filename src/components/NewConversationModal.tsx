"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PublicProfile } from "@/lib/profile";

export function NewConversationModal({ userId, onClose, onSelect }: {
  userId: string;
  onClose: () => void;
  onSelect: (profile: PublicProfile) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const term = query.trim().replace(/^@/, "").toLowerCase();
    const timer = setTimeout(async () => {
      if (term.length < 2) { setResults([]); setSearching(false); return; }
      const escaped = term.replace(/[\\%_]/g, "\\$&");
      const lookup = (column: "username" | "display_name") => createClient().from("profiles")
        .select("id,display_name,avatar_url,status,username").neq("id",userId)
        .ilike(column,`%${escaped}%`).order("display_name").limit(20).abortSignal(controller.signal);
      const found = await Promise.all([lookup("username"),lookup("display_name")]);
      if (controller.signal.aborted) return;
      setSearching(false);
      if (found.some(result=>result.error)) setError("Не удалось найти пользователя. Проверьте соединение.");
      else { setError(null); setResults([...new Map(found.flatMap(result=>result.data ?? []).filter(profile=>profile.display_name?.trim()).map(profile=>[profile.id,profile])).values()].slice(0,20)); }

    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, userId]);
  const select = async (profile: PublicProfile) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await onSelect(profile); onClose(); }
    catch { setError("Не удалось открыть переписку. Повторите попытку."); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[15vh] backdrop-blur-sm" onClick={event => {if(event.target===event.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="new-dm-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111113] p-5 text-white shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 id="new-dm-title" className="text-lg font-semibold">Новое сообщение</h2><button onClick={onClose} aria-label="Закрыть" className="rounded-lg px-3 py-1 text-white/50 hover:bg-white/10">×</button></div>
      <input autoFocus aria-label="Имя или юзернейм собеседника" maxLength={64} placeholder="Имя или @username" value={query} onChange={event=>{setQuery(event.target.value);setResults([]);setError(null);setSearching(event.target.value.trim().length>=2);}} onKeyDown={event=>{if(event.key==="Escape")onClose();}} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/30"/>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-3 max-h-72 overflow-auto">{results.map(profile=><button key={profile.id} disabled={busy} onClick={()=>void select(profile)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5 disabled:opacity-50">
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10">{profile.avatar_url?<img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/>:profile.display_name?.slice(0,1) ?? "?"}</span>
        <span><span className="block text-sm">{profile.display_name ?? profile.username}</span>{profile.username && <span className="text-xs text-white/40">@{profile.username}</span>}</span>
      </button>)}</div>
      {!results.length && <p className="mt-4 text-xs text-white/40">{searching ? "Поиск…" : query.trim().length >= 2 ? "Ничего не найдено." : "Введите хотя бы два символа имени или юзернейма."}</p>}
    </section>
  </div>;
}
