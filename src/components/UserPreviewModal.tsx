"use client";

import { useRef, useEffect } from "react";
import { FEmoji, statusEmoji } from "@/components/FEmoji";

// ─── Цвета кружков по роли ────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  owner:    { label: "Owner",      color: "#F59E0B" }, // золотой
  investor: { label: "Investor",   color: "#8B5CF6" }, // фиолетовый
  admin:    { label: "Admin",      color: "#EF4444" }, // красный
  mod:      { label: "Moderator",  color: "#3B82F6" }, // синий
  verified: { label: "Verified",   color: "#10B981" }, // зелёный
  bot:      { label: "Bot",        color: "#8A2BE2" }, // тёмно-фиолетовый
  scam:     { label: "Suspicious", color: "#FF4500" }, // оранжево-красный
};

const ROLE_PRIORITY = ["owner", "investor", "admin", "mod", "verified", "bot", "scam"];

// ─── Галочка в кружке ─────────────────────────────────────────────────────────
function CheckBadge({ role, size = 15 }: { role: string; size?: number }) {
  const conf = BADGE_CONFIG[role];
  if (!conf) return null;
  return (
    <span title={conf.label} style={{ display: "inline-flex", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="7.5" fill={conf.color} />
        <polyline
          points="3.8,7.5 6.2,10.2 11.2,4.8"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// Показывает только первый (наивысший) бейдж
function TopBadge({ badges, size }: { badges: string[]; size?: number }) {
  const top = ROLE_PRIORITY.find((r) => badges.includes(r));
  if (!top) return null;
  return <CheckBadge role={top} size={size} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserPreview {
  id: string;
  display_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string | null;
  email?: string | null;
  status: string | null;
  badges?: string[];
}

interface Props {
  user: UserPreview;
  onClose: () => void;
  onStartDM: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function UserPreviewModal({ user, onClose, onStartDM }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const userBadges = user.badges || [];

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const initials  = (user.display_name ?? "?").slice(0, 1).toUpperCase();
  const statusText = user.status?.split(" ").slice(1).join(" ") ?? "Online";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="group w-full max-w-[380px] rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden relative transition-all duration-200 hover:border-white/20">

        {/* Закрыть */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/40 hover:text-white/70 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Баннер */}
        <div className="h-28 w-full bg-zinc-800 relative overflow-hidden border-b border-white/5">
          {user.banner_url ? (
            <img src={user.banner_url} alt="" className="h-full w-full object-cover" />
          ) : user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-full w-full object-cover blur-md scale-110 opacity-40" />
          ) : null}
        </div>

        {/* Аватар + ряд галочек */}
        <div className="px-5 relative -mt-10 mb-3 flex items-end justify-between">
          <div className="relative">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover border-[4px] border-[#111113]" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-[#111113] bg-zinc-800 text-2xl font-bold text-white/60">
                {initials}
              </div>
            )}
            {/* Статус-точка */}
            <span className="absolute bottom-0.5 right-1 h-3.5 w-3.5 rounded-full border-2 border-[#111113] bg-green-500" />
          </div>

          {/* Все галочки юзера справа */}
          <div className="flex items-center gap-1 mb-1">
            {ROLE_PRIORITY.filter((r) => userBadges.includes(r)).map((r) => (
              <CheckBadge key={r} role={r} size={18} />
            ))}
          </div>
        </div>

        {/* Контент */}
        <div className="px-5 pb-5 space-y-4">

          {/* Имя + главная галочка рядом */}
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {user.display_name ?? "Unknown"}
              <TopBadge badges={userBadges} size={16} />
            </h2>
            {user.username && <p className="text-xs text-white/40 mt-0.5">@{user.username}</p>}
            {user.email    && <p className="text-xs text-white/25 mt-0.5">{user.email}</p>}
          </div>

          {/* Список ролей при наведении */}
          {userBadges.length > 0 && (
            <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-300 group-hover:max-h-60 group-hover:opacity-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Roles</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_PRIORITY.filter((r) => userBadges.includes(r)).map((r) => {
                  const conf = BADGE_CONFIG[r];
                  return (
                    <div
                      key={r}
                      className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs font-medium text-white/70"
                    >
                      <CheckBadge role={r} size={13} />
                      {conf.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Био */}
          {user.bio && (
            <p className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm text-white/70 leading-relaxed">
              {user.bio}
            </p>
          )}

          {/* Статус */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Status</p>
            <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-white/70">
              <FEmoji emoji={statusEmoji(user.status)} size={13} />
              <span>{statusText}</span>
            </div>
          </div>

          {/* Кнопка DM */}
          <button
            onClick={() => { onStartDM(); onClose(); }}
            className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
}