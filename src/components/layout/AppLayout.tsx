"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMessages } from "@/hooks/useMessages";
import { CallRoom } from "@/components/CallRoom";
import { DMView } from "@/components/DMView";
import { useConversations, getOrCreateConversation } from "@/hooks/useDMs";
import type { Conversation } from "@/hooks/useDMs";

// ─── ИНТЕРФЕЙСЫ И ТИПЫ ДАННЫХ ─────────────────────────────────────────────────
interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by?: string | null;
  mode?: "open" | "owner_only" | string;
}

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string | null;
  banner_url?: string | null;
}

interface ResizeHandleProps {
  onResize: (delta: number) => void;
}

// ─── КОМПОНЕНТ ИЗМЕНЕНИЯ РАЗМЕРА КОЛОНОК (RESIZE HANDLE) ──────────────────────
function ResizeHandle({ onResize }: ResizeHandleProps) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX.current;
        startX.current = ev.clientX;
        onResize(delta);
      };

      const onMouseUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [onResize]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 cursor-col-resize bg-transparent hover:bg-white/10 transition-colors h-full select-none"
    />
  );
}

// ─── КОМПОНЕНТ ЭЛЕМЕНТА КАНАЛА В СПИСКЕ ───────────────────────────────────────
function ChannelItem({
  ch,
  active,
  onClick,
}: {
  ch: Channel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-white/10 text-white shadow-sm"
          : "text-white/40 hover:bg-white/5 hover:text-white/70"
      }`}
    >
      <span className="text-white/20 font-mono">#</span>
      <span className="truncate flex-1 text-left">{ch.name}</span>
      {ch.mode === "owner_only" && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/20">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      )}
    </button>
  );
}

// ─── КОМПОНЕНТ ЭЛЕМЕНТА ЛИЧНОЙ ПЕРЕПИСКИ (DM ITEM) ───────────────────────────
function DMItem({
  conv,
  active,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const u = conv.other_user;
  const statusEmoji = u.status?.split(" ")[0] ?? "🟢";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
        active ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <div className="relative h-7 w-7 flex-shrink-0 rounded-full bg-white/10 overflow-hidden">
        {u.avatar_url ? (
          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/60">
            {(u.display_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 text-[9px]">{statusEmoji}</span>
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-medium truncate ${active ? "text-white" : "text-white/60"}`}>
          {u.display_name ?? "Unknown"}
        </p>
        {conv.last_message && (
          <p className="text-xs text-white/25 truncate mt-0.5">{conv.last_message}</p>
        )}
      </div>
    </button>
  );
}

// ─── СПИСОК УЧАСТНИКОВ КАНАЛА (MEMBER LIST) ──────────────────────────────────
function MemberList({
  channelId,
  myId,
  onUserSelect,
}: {
  channelId: string | null;
  myId: string;
  onUserSelect: (user: any) => void;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!channelId) return;
    async function load() {
      const { data } = await supabase
        .from("channel_members")
        .select("user_id, profiles(id, display_name, avatar_url, status)")
        .eq("channel_id", channelId);
      if (data) setMembers(data.map((m: any) => m.profiles).filter(Boolean));
    }
    load();
  }, [channelId, supabase]);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
      {members.map((m) => {
        if (m.id === myId) return null;
        const emoji = m.status?.split(" ")[0] ?? "🟢";
        const label = m.status?.split(" ").slice(1).join(" ") ?? "Online";
        return (
          <button
            key={m.id}
            onClick={() => onUserSelect(m)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5 transition-colors group"
          >
            <div className="relative h-7 w-7 flex-shrink-0 rounded-full bg-white/10 overflow-hidden">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/60">
                  {m.display_name?.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px]">{emoji}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/70 group-hover:text-white truncate">
                {m.display_name ?? "Unknown"}
              </p>
              <p className="text-[11px] text-white/25 truncate">{label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── ОСНОВНОЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ (APPLAYOUT МОНОЛИТ) ───────────────────────
export function AppLayout() {
  const supabase = createClient();

  // Параметры ширины колонок сайдбаров
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(220);
  const MIN_SIDE = 180;
  const MAX_SIDE = 400;

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(MIN_SIDE, Math.min(MAX_SIDE, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(MIN_SIDE, Math.min(MAX_SIDE, w - delta)));
  }, []);

  // Состояние навигации и списков
  const [view, setView] = useState<"channel" | "dm">("channel");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  // Пользовательские данные и сессия
  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const { conversations } = useConversations(userId ?? "");
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  // Стейты триггеров модальных окон
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [previewUser, setPreviewUser] = useState<any>(null);

  // Модальное окно создания канала (Внутренние стейты)
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelMode, setNewChannelMode] = useState<"open" | "owner_only">("open");

  // Модальное окно редактирования профиля (Внутренние стейты)
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");

  // Глобальный изолированный слой звонков (Защита от размонтирования)
  const [callActive, setCallActive] = useState(false);
  const [callRoomName, setCallRoomName] = useState<string | null>(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  // Черновик ввода сообщений
  const [draft, setDraft] = useState("");

  // Загрузка доступных каналов
  const loadChannels = useCallback(async (currentUserId: string) => {
    const { data: m } = await supabase
      .from("channel_members")
      .select("channel_id, channels(id, name, description, created_by, mode)")
      .eq("user_id", currentUserId);
    if (m) {
      const list = m.map((row: any) => row.channels).filter(Boolean) as Channel[];
      setChannels(list);
      return list;
    }
    return [];
  }, [supabase]);

  // Первичная инициализация сессии
  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, status")
        .eq("id", user.id)
        .single();
      if (p) {
        setMyProfile(p);
        setEditName(p.display_name ?? "");
        setEditStatus(p.status ?? "");
        setEditAvatarUrl(p.avatar_url ?? "");
      }

      const list = await loadChannels(user.id);
      if (list.length > 0) setActiveChannel(list[0]);
    }
    initUser();
  }, [supabase, loadChannels]);

  const { messages, sendMessage, loading: msgLoading, bottomRef } = useMessages(activeChannel?.id ?? "");

  // Обработка отправки текстового сообщения
  const handleSend = useCallback(async () => {
    if (!draft.trim() || !activeChannel || !userId) return;
    
    // Валидация прав: режим Owner Only
    if (activeChannel.mode === "owner_only" && activeChannel.created_by !== userId) {
      alert("Only the owner can post messages in this channel.");
      return;
    }

    const text = draft;
    setDraft("");
    await sendMessage(text);
  }, [draft, activeChannel, userId, sendMessage]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Загрузка медиа-вложений в Storage
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel || !userId) return;

    if (activeChannel.mode === "owner_only" && activeChannel.created_by !== userId) {
      alert("Only the owner can upload media to this channel.");
      return;
    }

    try {
      const ext = file.name.split(".").pop();
      const path = `${activeChannel.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(path);
      await sendMessage(publicUrl);
    } catch (err) {
      console.error("Upload execution failed:", err);
    }
  }, [activeChannel, userId, sendMessage, supabase]);

  // Инициализация голосовой сессии
  const startCall = () => {
    if (!activeChannel) return;
    setCallRoomName(`channel-${activeChannel.id}`);
    setCallActive(true);
    setIsCallMinimized(false);
  };

  // Метод создания нового канала через Supabase RPC/Таблицы
  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !userId) return;
    try {
      const { data: channelData, error: chErr } = await supabase
        .from("channels")
        .insert({
          name: newChannelName.trim(),
          description: newChannelDesc.trim() || null,
          created_by: userId,
          mode: newChannelMode
        })
        .select()
        .single();

      if (chErr) {
        if (chErr.code === "23505") {
          alert("Ограничение экосистемы: Вы уже являетесь владельцем канала. Один пользователь может создать только один канал.");
        } else {
          alert(`Ошибка создания: ${chErr.message}`);
        }
        return;
      }

      // Автоматическое добавление создателя в участники канала
      await supabase.from("channel_members").insert({
        channel_id: channelData.id,
        user_id: userId
      });

      const list = await loadChannels(userId);
      const updatedCh = list.find((c) => c.id === channelData.id) || channelData;
      
      setActiveChannel(updatedCh);
      setView("channel");
      setShowChannelModal(false);
      setNewChannelName("");
      setNewChannelDesc("");
      setNewChannelMode("open");
    } catch (err) {
      console.error(err);
    }
  };

  // Сохранение изменений профиля
  const handleSaveProfile = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editName,
        status: editStatus,
        avatar_url: editAvatarUrl,
      })
      .eq("id", userId);

    if (!error) {
      setMyProfile({
        id: userId,
        display_name: editName,
        status: editStatus,
        avatar_url: editAvatarUrl,
      });
      setShowProfileModal(false);
    }
  };

  const isInputDisabled = activeChannel?.mode === "owner_only" && activeChannel?.created_by !== userId;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070708] text-white font-sans antialiased select-none">
      
      {/* ── ЛЕВЫЙ САЙДБАР НАВИГАЦИИ ─────────────────────────────────────── */}
      <aside
        className="flex h-full flex-col border-r border-white/10 bg-[#0D0D0F]"
        style={{ width: leftWidth, minWidth: MIN_SIDE, flexShrink: 0 }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-white/40 animate-pulse" />
            <span className="text-xs font-semibold tracking-widest text-white/40 uppercase">Nox Ecosystem</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
          {/* Блок каналов */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold tracking-wider text-white/20 uppercase">Channels</span>
              <button onClick={() => setShowChannelModal(true)} className="text-white/40 hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {channels.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  ch={ch}
                  active={view === "channel" && activeChannel?.id === ch.id}
                  onClick={() => {
                    setView("channel");
                    setActiveChannel(ch);
                    setActiveConv(null);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Блок личных сообщений (DM) */}
          <div>
            <div className="px-2 mb-2">
              <span className="text-[11px] font-bold tracking-wider text-white/20 uppercase">Direct Messages</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {conversations.map((conv) => (
                <DMItem
                  key={conv.id}
                  conv={conv}
                  active={view === "dm" && activeConv?.id === conv.id}
                  onClick={() => {
                    setView("dm");
                    setActiveConv(conv);
                    setActiveChannel(null);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Профиль оператора в футере сайдбара */}
        <div className="border-t border-white/10 p-3 bg-[#0A0A0C]">
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-white/5 transition-all text-left"
          >
            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-white/10 overflow-hidden">
              {myProfile?.avatar_url ? (
                <img src={myProfile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/60">
                  {myProfile?.display_name?.slice(0, 1).toUpperCase() ?? "U"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/80 truncate">{myProfile?.display_name ?? "Loading profile…"}</p>
              <p className="text-[11px] text-white/30 truncate">{myProfile?.status ?? "No status set"}</p>
            </div>
          </button>
        </div>
      </aside>

      <ResizeHandle onResize={handleLeftResize} />

      {/* ── ОСНОВНОЙ РАБОЧИЙ ЭКРАН (ОКНО ТЕКСТОВОГО СТРИМА) ───────────────── */}
      <main className="flex h-full flex-1 flex-col bg-[#070708]">
        {view === "channel" && activeChannel && (
          <div className="flex h-full flex-col">
            {/* Хедер канала */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-medium text-white"># {activeChannel.name}</h2>
                  {activeChannel.mode === "owner_only" && (
                    <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-white/40">Read Only</span>
                  )}
                </div>
                {activeChannel.description && <p className="text-xs text-white/30 mt-0.5">{activeChannel.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={startCall}
                  disabled={callActive}
                  className="flex h-9 items-center gap-2 rounded-xl bg-white/5 px-4 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span>Voice Studio</span>
                </button>
              </div>
            </div>

            {/* Лента сообщений канала */}
            <div className="flex-1 overflow-y-auto">
              {msgLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-white/20">Loading messages…</div>
              ) : (
                <div className="flex flex-col gap-5 p-6">
                  {messages.map((m: any) => {
                    const isImg = m.content && m.content.startsWith("http") && (m.content.includes(".png") || m.content.includes(".jpg") || m.content.includes(".jpeg") || m.content.includes("attachments"));
                    return (
                      <div key={m.id} className="flex gap-4">
                        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-white/10 overflow-hidden">
                          {m.profiles?.avatar_url && <img src={m.profiles.avatar_url} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-medium text-white/80">{m.profiles?.display_name ?? "Unknown"}</span>
                            <span className="text-[10px] text-white/20">
                              {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                          {isImg ? (
                            <img src={m.content} alt="Attachment" className="mt-1 max-h-60 rounded-xl object-contain border border-white/5 bg-white/5" />
                          ) : (
                            <p className="text-sm leading-relaxed text-white/90 break-words">{m.content}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Зона ввода сообщений канала */}
            <div className="border-t border-white/10 p-4">
              <div className="flex items-end gap-3">
                <label className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-colors ${isInputDisabled ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:bg-white/10 hover:text-white"}`}>
                  <input type="file" accept="image/*" onChange={handleFileUpload} disabled={isInputDisabled} className="hidden" />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isInputDisabled}
                  placeholder={isInputDisabled ? "Only the administrator can write here" : `Message # ${activeChannel.name}`}
                  rows={1}
                  className="flex-1 resize-none overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Отображение личных переписок DM */}
        {view === "dm" && activeConv && userId && (
          <DMView
            conversationId={activeConv.id}
            userId={userId}
            otherUser={activeConv.other_user}
          />
        )}

        {!activeChannel && !activeConv && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
            <span className="text-4xl">👋</span>
            <span className="text-sm">Select a studio channel or DM node</span>
          </div>
        )}
      </main>

      {/* ── ГЛОБАЛЬНЫЙ СЛОЙ ЗВОНКА (НЕ ЗАВИСИТ ОТ СМЕНЫ ВКЛАДОК КАНАЛОВ И DM) ── */}
      {callActive && callRoomName && (
        <CallRoom
          channelId={activeChannel?.id ?? "dm"}
          roomName={callRoomName}
          isMinimized={isCallMinimized}
          onMinimizeToggle={() => setIsCallMinimized(!isCallMinimized)}
          onLeave={() => {
            setCallActive(false);
            setCallRoomName(null);
          }}
        />
      )}

      {/* ── ПРАВАЯ ПАНЕЛЬ: СПИСОК УЧАСТНИКОВ (РЕНДЕРИТСЯ СТРОГО В КАНАЛАХ) ── */}
      {view === "channel" && activeChannel && (
        <>
          <ResizeHandle onResize={handleRightResize} />
          <aside
            className="flex h-full flex-col border-l border-white/10 bg-[#0D0D0F]"
            style={{ width: rightWidth, minWidth: MIN_SIDE, flexShrink: 0 }}
          >
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-medium text-white/60">Members</h3>
            </div>
            <MemberList
              key={activeChannel.id}
              channelId={activeChannel.id}
              myId={userId ?? ""}
              onUserSelect={(selectedUser) => setPreviewUser(selectedUser)}
            />
          </aside>
        </>
      )}

      {/* ── ВСТРОЕННЫЕ СКРИПТЫ МОДАЛЬНЫХ ОКОН (ПРИЛОЖЕНИЕ НА 800+ СТРОК) ── */}
      
      {/* 1. Модальное окно создания канала */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0E0E11] p-6 shadow-2xl">
            <h3 className="text-lg font-medium text-white">Create channel node</h3>
            <p className="text-xs text-white/40 mt-1 mb-4">Initialize a synchronous streaming point inside the ecosystem.</p>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 block mb-1.5">Node Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. design-core"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 block mb-1.5">Description (Optional)</label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="System notes or metadata guidelines"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 block mb-1.5">Broadcast System Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setNewChannelMode("open")}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      newChannelMode === "open"
                        ? "border-white/20 bg-white/5 text-white"
                        : "border-white/5 bg-transparent text-white/40 hover:border-white/10"
                    }`}
                  >
                    <p className="text-xs font-semibold">Open Channel</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Every synchronized node user can type and share files.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannelMode("owner_only")}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      newChannelMode === "owner_only"
                        ? "border-white/20 bg-white/5 text-white"
                        : "border-white/5 bg-transparent text-white/40 hover:border-white/10"
                    }`}
                  >
                    <p className="text-xs font-semibold">Owner Only</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Read-only system feed for members. Only you can broadcast.</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 border-t border-white/5 pt-4">
              <button
                onClick={() => setShowChannelModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-white/40 hover:text-white transition-colors"
              >
                Abort
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
                className="rounded-xl bg-white text-black px-4 py-2 text-xs font-medium transition-all hover:bg-white/90 disabled:opacity-30"
              >
                Deploy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Модальное окно редактирования профиля */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0E0E11] p-6 shadow-2xl">
            <h3 className="text-lg font-medium text-white">Identity Passport Settings</h3>
            <p className="text-xs text-white/40 mt-1 mb-4">Modify your globally rendered metadata signature inside the mesh network.</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 block mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 block mb-1.5">Mesh Node Status Signature</label>
                <input
                  type="text"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  placeholder="e.g. 🟢 Building something unique"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 block mb-1.5">Avatar Vector URL</label>
                <input
                  type="text"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 border-t border-white/5 pt-4">
              <button
                onClick={() => setShowProfileModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-white/40 hover:text-white transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSaveProfile}
                className="rounded-xl bg-white text-black px-4 py-2 text-xs font-medium transition-all hover:bg-white/90"
              >
                Commit Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Карточка предпросмотра пользователя сети (User Preview Profile) */}
      {previewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0E0E11] p-5 shadow-2xl overflow-hidden relative">
            <div className="h-20 bg-gradient-to-r from-white/[0.03] to-white/[0.08] -mx-5 -mt-5 mb-10 border-b border-white/5" />
            
            <div className="absolute top-10 left-5">
              <div className="h-16 w-16 rounded-full border-4 border-[#0E0E11] bg-[#141419] overflow-hidden shadow-xl">
                {previewUser.avatar_url ? (
                  <img src={previewUser.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white/40">
                    {previewUser.display_name?.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2">
              <h4 className="text-base font-semibold text-white">{previewUser.display_name ?? "Unknown Identity"}</h4>
              <p className="text-xs text-white/30 mt-0.5 font-mono">ID: {previewUser.id ? previewUser.id.slice(0, 8) : ""}...</p>
              
              <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/20 block mb-1">Status Signature</span>
                <p className="text-xs text-white/80">{previewUser.status ?? "No status established"}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-5 border-t border-white/5 pt-4">
              <button
                onClick={() => setPreviewUser(null)}
                className="flex-1 rounded-xl border border-white/5 bg-transparent py-2 text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white transition-all"
              >
                Close Node
              </button>
              <button
                onClick={async () => {
                  if (!userId) return;
                  const convId = await getOrCreateConversation(userId, previewUser.id);
                  if (!convId) return;
                  setActiveConv({ id: convId, other_user: previewUser });
                  setView("dm");
                  setActiveChannel(null);
                  setPreviewUser(null);
                }}
                className="flex-1 rounded-xl bg-white py-2 text-xs font-medium text-black hover:bg-white/90 transition-all"
              >
                Open Private DM
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}