"use client";

import { useRef, useEffect } from "react";

interface UserPreview {
  id: string;
  display_name: string | null;
  username?: string | null;     // Добавили @username
  avatar_url: string | null;
  banner_url?: string | null;   // Добавили баннер
  bio?: string | null;          // Добавили био
  email?: string | null;        // Добавили почту
  status: string | null;
}

interface Props {
  user: UserPreview;
  onClose: () => void;
  onStartDM: () => void;
}

export function UserPreviewModal({ user, onClose, onStartDM }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const initials = (user.display_name ?? "?").slice(0, 1).toUpperCase();
  const emoji = user.status?.split(" ")[0] ?? "🟢";
  const statusText = user.status?.split(" ").slice(1).join(" ") ?? "Online";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-[400px] rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        
        {/* Кнопка закрытия [X] в углу */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/40 hover:text-white/70 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* 1. БАННЕР ПРОФИЛЯ */}
        <div className="h-28 w-full bg-zinc-800 relative overflow-hidden border-b border-white/5">
          {user.banner_url ? (
            <img src={user.banner_url} alt="" className="h-full w-full object-cover" />
          ) : (
            // Дефолтный баннер (можно сделать как дубликат авы с размытием, как на фото!)
            user.avatar_url && <img src={user.avatar_url} alt="" className="h-full w-full object-cover blur-md scale-110 opacity-50" />
          )}
        </div>

        {/* 2. АВАТАРКА С ИНДИКАТОРОМ (наползает на баннер) */}
        <div className="px-5 relative -mt-10 mb-3 flex items-end justify-between">
          <div className="relative">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-20 w-20 rounded-full object-cover border-[4px] border-[#111113] bg-[#111113]"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-[#111113] bg-zinc-800 text-xl font-bold text-white/60">
                {initials}
              </div>
            )}
            {/* Зеленая точка статуса */}
            <span className="absolute bottom-0 right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#111113] bg-green-500 text-[10px]">
              {/* Если статус кастомный эмодзи, можно засунуть внутрь, но просто точка выглядит аккуратнее */}
            </span>
          </div>
        </div>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <div className="px-5 pb-5 space-y-4">
          
          {/* Имена */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {user.display_name ?? "Unknown"}
            </h2>
            {user.username && (
              <p className="text-xs text-white/40 mt-0.5">@{user.username}</p>
            )}
            {user.email && (
              <p className="text-xs text-white/30 mt-0.5">{user.email}</p>
            )}
          </div>

          {/* БИО (Кастомная плашка) */}
          {user.bio && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-sm text-white/80 leading-normal">
              {user.bio}
            </div>
          )}

          {/* ИНФО-ПОЛЯ (Как на скриншоте) */}
          <div className="space-y-3 pt-1">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Display name</span>
              <div className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-white/80">
                {user.display_name ?? "—"}
              </div>
            </div>

            {user.username && (
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Username</span>
                <div className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-white/50">
                  @{user.username}
                </div>
              </div>
            )}

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Status</span>
              <div className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-white/80 flex items-center gap-2">
                <span>{emoji}</span>
                <span>{statusText}</span>
              </div>
            </div>
          </div>

          {/* КНОПКА ОТПРАВКИ СООБЩЕНИЯ */}
          <div className="pt-2">
            <button
              onClick={() => {
                onStartDM();
                onClose();
              }}
              className="w-full rounded-xl bg-white text-black font-medium py-2.5 text-sm transition-opacity hover:opacity-90 shadow-sm"
            >
              Send Message
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}