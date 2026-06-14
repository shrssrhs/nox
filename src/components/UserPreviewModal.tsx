"use client";

import { useRef, useEffect } from "react";

// Словарь со стилями и текстом для каждой галочки
const BADGE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  owner: { label: "Owner", icon: "👑", color: "text-[#FFD700]", bg: "bg-[#FFD700]/10 border-[#FFD700]/20" },
  admin: { label: "Admin", icon: "🛡️", color: "text-[#A30000]", bg: "bg-[#A30000]/10 border-[#A30000]/20" },
  mod: { label: "Moderator", icon: "⚔️", color: "text-[#0088CC]", bg: "bg-[#0088CC]/10 border-[#0088CC]/20" },
  verified: { label: "Verified", icon: "⭐", color: "text-[#00B359]", bg: "bg-[#00B359]/10 border-[#00B359]/20" },
  bot: { label: "Bot", icon: "🤖", color: "text-[#8A2BE2]", bg: "bg-[#8A2BE2]/10 border-[#8A2BE2]/20" },
  scam: { label: "Suspicious", icon: "⚠️", color: "text-[#FF4500]", bg: "bg-[#FF4500]/10 border-[#FF4500]/20" },
  investor: { label: "Investor", icon: "💎", color: "text-[#00F5D4]", bg: "bg-[#00F5D4]/10 border-[#00F5D4]/20" },
};

interface UserPreview {
  id: string;
  display_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string | null;
  email?: string | null;
  status: string | null;
  badges?: string[]; // массив галочек пользователя
}

interface Props {
  user: UserPreview;
  onClose: () => void;
  onStartDM: () => void;
}

export function UserPreviewModal({ user, onClose, onStartDM }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const userBadges = user.badges || [];

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
      {/* Добавляем класс group на всю карточку, чтобы отслеживать hover */}
      <div className="group w-full max-w-[400px] rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative transition-all duration-300 hover:border-white/20">
        
        {/* Кнопка закрытия [X] */}
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
            user.avatar_url && <img src={user.avatar_url} alt="" className="h-full w-full object-cover blur-md scale-110 opacity-50" />
          )}
        </div>

        {/* 2. АВАТАРКА И БЕЙДЖИ */}
        <div className="px-5 relative -mt-10 mb-3 flex items-end justify-between">
          <div className="relative">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover border-[4px] border-[#111113] bg-[#111113]" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-[#111113] bg-zinc-800 text-xl font-bold text-white/60">{initials}</div>
            )}
            <span className="absolute bottom-0 right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#111113] bg-green-500" />
          </div>

          {/* Строка компактных иконок галочек в углу аватара */}
          <div className="flex gap-1 mb-1">
            {userBadges.map((b) => {
              const conf = BADGE_CONFIG[b];
              if (!conf) return null;
              return (
                <span key={b} title={conf.label} className="cursor-default text-lg select-none">
                  {conf.icon}
                </span>
              );
            })}
          </div>
        </div>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <div className="px-5 pb-5 space-y-4">
          
          {/* Имена */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {user.display_name ?? "Unknown"}
            </h2>
            {user.username && <p className="text-xs text-white/40 mt-0.5">@{user.username}</p>}
            {user.email && <p className="text-xs text-white/30 mt-0.5">{user.email}</p>}
          </div>

          {/* ── ДИНАМИЧЕСКИЙ СПИСОК ГАЛОЧЕК ПРИ НАВЕДЕНИИ ── */}
          {userBadges.length > 0 && (
            <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-300 ease-in-out group-hover:max-h-[300px] group-hover:opacity-100 group-hover:mb-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Badges & Roles</span>
              <div className="grid grid-cols-2 gap-2">
                {userBadges.map((b) => {
                  const conf = BADGE_CONFIG[b];
                  if (!conf) return null;
                  return (
                    <div key={b} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${conf.bg} text-xs font-medium ${conf.color}`}>
                      <span className="text-sm">{conf.icon}</span>
                      <span>{conf.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* БИО */}
          {user.bio && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-sm text-white/80 leading-normal">
              {user.bio}
            </div>
          )}

          {/* ИНФО-ПОЛЯ */}
          <div className="space-y-3 pt-1">
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