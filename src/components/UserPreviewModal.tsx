"use client";

import { useRef, useEffect } from "react";

interface UserPreview {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Аватар и Статус */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-20 w-20 rounded-full object-cover border-2 border-white/5"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-2xl font-semibold text-white/70">
                {initials}
              </div>
            )}
            <span className="absolute bottom-0 right-0 text-xl bg-[#111113] p-0.5 rounded-full">{emoji}</span>
          </div>

          {/* Имя пользователя */}
          <h3 className="text-lg font-medium text-white">{user.display_name ?? "Unknown"}</h3>
          
          {/* Текст статуса */}
          <p className="mt-1 text-xs text-white/40">{statusText}</p>
        </div>

        <div className="my-5 border-t border-white/5" />

        {/* Кнопки действий */}
        <div className="space-y-2">
          <button
            onClick={() => {
              onStartDM();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Send Message
          </button>
          
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-transparent py-2 text-xs text-white/30 transition-colors hover:text-white/50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}