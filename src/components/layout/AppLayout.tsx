"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserChannels } from "@/lib/channels";
import { useMessages } from "@/hooks/useMessages";
import type { Message } from "@/hooks/useMessages";
import { CallRoom } from "@/components/CallRoom";
import { ProfileModal } from "@/components/ProfileModal";
import { DMView } from "@/components/DMView";
import { useConversations, getOrCreateConversation } from "@/hooks/useDMs";
import type { Conversation } from "@/hooks/useDMs";
import { ChannelModal } from "@/components/ChannelModal";
import { DMProfilePanel } from "@/components/DMProfilePanel";
import { UserPreviewModal } from "@/components/UserPreviewModal";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Channel {
  id: string;
  name: string;
  description: string | null;
}

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  status: string | null;
}

interface ResizeHandleProps {
  onResize: (delta: number) => void;
}

// ─── Thin drag handle ─────────────────────────────────────────────────────────
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
      className="group relative z-10 flex w-1 cursor-col-resize items-center justify-center"
      style={{ flexShrink: 0 }}
    >
      {/* Invisible wider hit-area */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
      {/* Visible line */}
      <div className="h-full w-px bg-white/10 transition-colors group-hover:bg-white/30" />
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 8 }: { name: string | null; url?: string | null; size?: number }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  const cls = "flex items-center justify-center rounded-full bg-white/10 text-xs font-medium overflow-hidden";
  const style = { width: size * 4, height: size * 4, flexShrink: 0 as const };
  if (url) return <img src={url} alt={name ?? ""} className={`${cls} object-cover`} style={style} />;
  return <div className={cls} style={style}>{initials}</div>;
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const name = msg.profiles?.display_name ?? "Unknown";
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const badges = (msg.profiles as any)?.badges || [];
  const text = msg.content;

  // Стейты для контекстного меню
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // Стейты для редактирования
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);

  const isImage = /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(text);
  const isVideo = /\.(mp4|webm|ogg|mov)($|\?)/i.test(text);
  const isStorageFile = text.startsWith("http") && text.includes("/storage/v1/object/public/");

  // Открытие кастомного меню по ПКМ
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Глушим дефолтное меню браузера
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuVisible(true);
  };

  // Закрытие меню при клике в любое другое место
  useEffect(() => {
    const closeMenu = () => setMenuVisible(false);
    if (menuVisible) {
      window.addEventListener("click", closeMenu);
    }
    return () => window.removeEventListener("click", closeMenu);
  }, [menuVisible]);

  // Функции-заглушки для действий
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };

  const handleDelete = () => {
    console.log("Удалить сообщение из Supabase:", msg.id);
  };

  const handleSaveEdit = () => {
    console.log("Сохранить изменения в Supabase:", editValue);
    setIsEditing(false);
  };

  return (
    <div 
      onContextMenu={handleContextMenu}
      className={`relative flex gap-3 select-none ${isOwn ? "flex-row-reverse" : ""}`}
    >
      <Avatar name={name} url={msg.profiles?.avatar_url} size={8} />
      
      <div className={`flex max-w-[70%] flex-col gap-1 ${isOwn ? "items-end" : ""}`}>
        <div className="flex items-baseline gap-2">
          {!isOwn && (
            <span className="text-xs font-medium text-white/70 flex items-center gap-1">
              {name}
              {(["owner","investor","admin","mod","verified"] as const)
                .filter(r => badges.includes(r))
                .slice(0, 1)
                .map(r => {
                  const colors: Record<string, string> = {
                    owner: "#F59E0B", investor: "#8B5CF6", admin: "#EF4444",
                    mod: "#3B82F6", verified: "#10B981"
                  };
                  return (
                    <svg key={r} width="13" height="13" viewBox="0 0 15 15" fill="none">
                      <circle cx="7.5" cy="7.5" r="7.5" fill={colors[r]} />
                      <polyline points="3.8,7.5 6.2,10.2 11.2,4.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  );
                })
              }
            </span>
          )}
          <span className="text-[11px] text-white/30">{time}</span>
        </div>
        
        <div
          className={`rounded-2xl text-sm leading-relaxed overflow-hidden ${
            isImage || isVideo 
              ? "bg-transparent p-0" 
              : isOwn
                ? "rounded-tr-sm bg-white/10 px-4 py-2.5 text-white"
                : "rounded-tl-sm bg-white/5 px-4 py-2.5 text-white/90"
          }`}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[220px]">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-white/20 resize-none font-sans"
                rows={2}
              />
              <div className="flex justify-end gap-1.5 text-xs font-mono">
                <button onClick={() => setIsEditing(false)} className="text-white/40 hover:text-white px-2 py-1">[cancel]</button>
                <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300 px-2 py-1">[save]</button>
              </div>
            </div>
          ) : isImage ? (
            <img src={text} alt="Shared media" className="max-w-xs md:max-w-md max-h-72 rounded-xl object-contain border border-white/10 bg-black/20" loading="lazy" />
          ) : isVideo ? (
            <video src={text} controls className="max-w-xs md:max-w-md max-h-72 rounded-xl border border-white/10 bg-black/20"/>
          ) : isStorageFile ? (
            <a href={text} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 rounded-xl transition-colors text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/60">📎</div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-medium truncate max-w-[180px] text-white/80">
                  {text.split('/').pop()?.split('-').slice(1).join('-') || "Shared File"}
                </p>
                <p className="text-[10px] text-white/30">Click to download</p>
              </div>
            </a>
          ) : (
            text
          )}
        </div>
      </div>

      {/* ─── КАСТОМНОЕ КОНТЕКСТНОЕ МЕНЮ (ПКМ) ─── */}
      {menuVisible && (
        <div
          className="fixed z-50 flex flex-col min-w-[120px] bg-[#0D0D0F] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-md"
          style={{ top: menuPosition.y, left: menuPosition.x }}
          onClick={(e) => e.stopPropagation()} // Чтобы клик внутри меню не закрывал его раньше времени
        >
          <button className="w-full text-left font-mono text-xs text-white/50 hover:text-white hover:bg-white/5 rounded-lg px-3 py-1.5 transition-colors">
            [reply]
          </button>
          
          {isOwn && !isImage && !isVideo && !isStorageFile && (
            <button 
              onClick={() => { setIsEditing(true); setMenuVisible(false); }}
              className="w-full text-left font-mono text-xs text-white/50 hover:text-white hover:bg-white/5 rounded-lg px-3 py-1.5 transition-colors"
            >
              [edit]
            </button>
          )}
          
          <button className="w-full text-left font-mono text-xs text-white/50 hover:text-white hover:bg-white/5 rounded-lg px-3 py-1.5 transition-colors">
            [pin]
          </button>
          
          <button 
            onClick={() => { handleCopy(); setMenuVisible(false); }}
            className="w-full text-left font-mono text-xs text-white/50 hover:text-white hover:bg-white/5 rounded-lg px-3 py-1.5 transition-colors"
          >
            [copy]
          </button>
          
          {isOwn && (
            <div className="my-1 border-t border-white/5" /> // Тонкий разделитель перед удалением
          )}

          {isOwn && (
            <button 
              onClick={() => { handleDelete(); setMenuVisible(false); }}
              className="w-full text-left font-mono text-xs text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-1.5 transition-colors"
            >
              [delete]
            </button>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Member list ──────────────────────────────────────────────────────────────
const supabaseClient = createClient();

interface MemberListProps {
  channelId: string | null;
  myId: string;
  onDM: (otherId: string, otherUser: { id: string; display_name: string | null; avatar_url: string | null; status: string | null }) => void;
}

function MemberList({ channelId, myId, onDM }: MemberListProps) {
  const [members, setMembers] = useState<{ id: string; display_name: string | null; avatar_url: string | null; status: string | null }[]>([]);

  useEffect(() => {
    if (!channelId) { setMembers([]); return; }
    supabaseClient
      .from("channel_members")
      .select("profiles(id, display_name, avatar_url, status, username, bio, banner_url, email, badges)")
      .eq("channel_id", channelId)
      .then(({ data }) => {
        const list = (data ?? []).map((r: any) => r.profiles).filter(Boolean);
        setMembers(list);
      });
  }, [channelId]);

  if (!channelId) {
    return <div className="p-4 text-xs text-white/20">Select a channel to see members.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {members.map((m) => {
        const emoji = m.status?.split(" ")[0] ?? "🟢";
        const isMe = m.id === myId;
        return (
          <div
            key={m.id}
            onClick={() => !isMe && onDM(m.id, m)}
            className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${!isMe ? "cursor-pointer hover:bg-white/5" : ""}`}
          >
            <div className="relative flex-shrink-0">
              {m.avatar_url
                ? <img src={m.avatar_url} className="h-7 w-7 rounded-full object-cover" alt=""/>
                : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs">
                    {(m.display_name ?? "?").slice(0,1).toUpperCase()}
                  </div>
              }
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px]">{emoji}</span>
            </div>
            <span className="flex-1 truncate text-xs text-white/60 group-hover:text-white/80 flex items-center gap-1">
              {m.display_name ?? "Unknown"}
              {(() => {
                const badges = (m as any).badges || [];
                const colors: Record<string, string> = {
                  owner: "#F59E0B", investor: "#8B5CF6", admin: "#EF4444",
                  mod: "#3B82F6", verified: "#10B981",
                };
                const top = ["owner","investor","admin","mod","verified"].find(r => badges.includes(r));
                if (!top) return null;
                return (
                  <svg width="11" height="11" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="7.5" fill={colors[top]} />
                    <polyline points="3.8,7.5 6.2,10.2 11.2,4.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                );
              })()}
              {isMe && <span className="ml-1 text-white/25">(you)</span>}
            </span>
            {!isMe && (
              <svg className="opacity-0 group-hover:opacity-40" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export function AppLayout() {
  const supabase = createClient();

  // Layout
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leftWidth, setLeftWidth]   = useState(260);
  const [rightWidth, setRightWidth] = useState(260);
  const MIN_SIDE = 180;
  const MAX_SIDE = 480;
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const handleLeftResize  = useCallback((d: number) => setLeftWidth((w)  => clamp(w + d, MIN_SIDE, MAX_SIDE)), []);
  const handleRightResize = useCallback((d: number) => setRightWidth((w) => clamp(w - d, MIN_SIDE, MAX_SIDE)), []);

  // Auth / profile
  const [previewUser, setPreviewUser] = useState<any | null>(null);
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [userId, setUserId]       = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  
  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, status")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      } else {
        setProfile({
          display_name: user.user_metadata?.full_name ?? user.email ?? "Anonymous",
          avatar_url: user.user_metadata?.avatar_url ?? null,
          status: "🟢 Online",
        });
      }
    }

    initUser();
  }, [supabase]);

  // Channels
  const [channels, setChannels]           = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  // DMs
  const { conversations } = useConversations(userId ?? "");
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [view, setView] = useState<"channel" | "dm">("channel");

  useEffect(() => {
    // Ждем, пока загрузится реальный userId
    if (!userId) return;
  
    async function loadChannels() {
      const list = await fetchUserChannels(supabase, userId!);

      if (list.length === 0) {
        setChannels([]);
        setChannelModalOpen(true);
        return;
      }

      setChannels(list);

      if (list.length > 0) {
        setActiveChannel(list[0]);
      }
    }
  
    loadChannels();
  }, [userId]); // <-- Добавили userId в зависимости, чтобы код перезапускался при входе пользователя

  // Messages
  const { messages, sendMessage, loading, bottomRef } = useMessages(
    activeChannel?.id ?? ""
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Если канал не выбран или сейчас уже идет загрузка — игнорим
      if (!activeChannel?.id || uploadingFile) return;
  
      const items = e.clipboardData?.items;
      if (!items) return;
  
      for (let i = 0; i < items.length; i++) {
        // Ищем файлы (картинки, файлы и т.д.) среди объектов буфера
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault(); // отменяем стандартное поведение (например, вставку текста [object File])
            handleFileUpload(file); // передаем файл напрямую в загрузчик
            break; // берем только первый файл, если их несколько
          }
        }
      }
    };
  
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeChannel, uploadingFile]); // хук обновится при смене канала

  const handleFileUpload = async (eOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    let file: File | null = null;
  
    if (eOrFile instanceof File) {
      file = eOrFile;
    } else {
      file = eOrFile.target.files?.[0] || null;
    }
  
    if (!file || !activeChannel?.id) return;
  
    try {
      setUploadingFile(true);
  
      const fileExt = file.name.split('.').pop() || 'png';
      // Если имя файла дефолтное из буфера (image.png), делаем его уникальным
      const baseName = file.name.startsWith('image') ? 'clipboard' : file.name.split('-')[0];
      const fileName = `${baseName}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${activeChannel.id}/${fileName}`;
  
      const { data, error } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);
  
      if (error) throw error;
  
      const { data: { publicUrl } } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);
  
      await sendMessage(publicUrl);
  
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Input
  const [draft, setDraft] = useState("");
  const sending = useRef(false);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    const text = draft;
    setDraft("");
    await sendMessage(text);
    sending.current = false;
  }, [draft, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Call
  const [callActive, setCallActive] = useState(false);
  const [callRoomName, setCallRoomName] = useState("");
  const [callChannelId, setCallChannelId] = useState("");
  const [callChannelName, setCallChannelName] = useState("");

  // Inline = viewing the channel where the call is; Floating = everywhere else
  const callIsInline =
    callActive &&
    view === "channel" &&
    activeChannel?.id === callChannelId;
  const callIsFloating = callActive && !callIsInline;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090B] text-white">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside
        className="flex h-full flex-col border-r border-white/10 bg-[#0D0D0F]"
        style={{ width: leftWidth, minWidth: MIN_SIDE, flexShrink: 0 }}
      >
        <div className="border-b border-white/10 p-5">
          <h1 className="text-xl font-semibold tracking-tight">Nox</h1>
          <button
            onClick={() => setChannelModalOpen(true)}
            className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            + New Chat
          </button>
        </div>

        {channelModalOpen && userId && (
          <ChannelModal
            userId={userId}
            onClose={() => setChannelModalOpen(false)}
            onJoin={(ch) => {
              setChannels((prev) => {
                const exists = prev.find((c) => c.id === ch.id);
                if (exists) return prev;
                return [...prev, ch];
              });
              setActiveChannel(ch);
              setActiveConv(null);
              setView("channel");
            }}
          />
        )}

        <nav className="flex-1 overflow-y-auto p-3">
          {/* Channels */}
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">
            Channels
          </p>
          {channels.length === 0 && (
            <p className="px-2 py-2 text-xs text-white/20">No channels yet</p>
          )}
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => { setActiveChannel(ch); setActiveConv(null); setView("channel"); }}
              className={`mb-0.5 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                view === "channel" && activeChannel?.id === ch.id
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="mr-2 opacity-40">#</span>
              {ch.name}
            </button>
          ))}

          {/* DMs */}
          <p className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">
            Direct Messages
          </p>
          {conversations.length === 0 && (
            <p className="px-2 py-2 text-xs text-white/20">No DMs yet</p>
          )}
          {conversations.map((conv) => {
            const emoji = conv.other_user.status?.split(" ")[0] ?? "🟢";
            return (
              <button
                key={conv.id}
                onClick={() => { setActiveConv(conv); setActiveChannel(null); setView("dm"); }}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  view === "dm" && activeConv?.id === conv.id
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="relative flex-shrink-0">
                  {conv.other_user.avatar_url
                    ? <img src={conv.other_user.avatar_url} className="h-6 w-6 rounded-full object-cover" alt=""/>
                    : <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px]">
                        {(conv.other_user.display_name ?? "?").slice(0,1).toUpperCase()}
                      </div>
                  }
                  <span className="absolute -bottom-0.5 -right-0.5 text-[8px]">{emoji}</span>
                </div>
                <span className="truncate">{conv.other_user.display_name ?? "Unknown"}</span>
              </button>
            );
          })}
        </nav>

        {/* ── BUTTON SUPPORT PROJECT ──────────────────────────────────────── */}
        <div className="px-3 mb-2">
          <a
            href="https://donatello.to/onir_nox" // Тут измени на свой точный ник в Donatello, если нужно
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 
                       font-mono text-[11px] text-white/30 rounded-lg 
                       border border-dashed border-white/10 bg-white/[0.01]
                       hover:text-white/80 hover:border-white/20 hover:bg-white/[0.03] 
                       transition-all duration-200 select-none"
          >
            <span>[ Support Project ]</span>
          </a>
        </div>

        {/* User Profile Block */}
        <div className="border-t border-white/10 p-4">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/5"
          >
            <div className="relative">
              <Avatar name={profile?.display_name ?? null} url={profile?.avatar_url} size={8} />
              {/* Status dot */}
              <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">
                {profile?.status?.split(" ")[0] ?? "🟢"}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm text-white/80">
                {profile?.display_name ?? "Loading…"}
              </p>
              <p className="truncate text-xs text-white/30">
                {profile?.status?.split(" ").slice(1).join(" ") ?? "Online"}
              </p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
          </button>
        </div>

        {/* Profile modal */}
        {profileOpen && userId && (
          <ProfileModal
            userId={userId}
            onClose={() => setProfileOpen(false)}
            onUpdate={(p) => setProfile({ display_name: p.display_name, avatar_url: p.avatar_url, status: p.status })}
          />
        )}
      </aside>

      <ResizeHandle onResize={handleLeftResize} />

      {/* ── MAIN CHAT ────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* DM view */}
        {view === "dm" && activeConv && userId && (
          <DMView
            conversationId={activeConv.id}
            userId={userId}
            otherUser={activeConv.other_user}
          />
        )}

        {/* Channel header */}
        {view === "channel" && (
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-medium">{activeChannel?.name ?? "—"}</h2>
            {activeChannel?.description && (
              <span className="hidden text-xs text-white/30 sm:block">
                {activeChannel.description}
              </span>
            )}
          </div>

          {activeChannel && (
            <button
              onClick={() => {
                if (callActive && activeChannel.id === callChannelId) {
                  setCallActive(false);
                  setCallRoomName("");
                  setCallChannelId("");
                  setCallChannelName("");
                } else {
                  setCallRoomName(`nox-${activeChannel.id}`);
                  setCallChannelId(activeChannel.id);
                  setCallChannelName(activeChannel.name);
                  setCallActive(true);
                }
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
                callActive && activeChannel.id === callChannelId
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {callActive && activeChannel.id === callChannelId ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  End call
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  Call
                </>
              )}
            </button>
          )}
        </div>
        )}

        {/* Call panel — persists across view changes via CSS-only mode switch */}
        {callActive && callRoomName && (
          <div
            style={
              callIsInline
                ? {
                    height: 340,
                    flexShrink: 0,
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                  }
                : {
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    width: 320,
                    height: 224,
                    zIndex: 50,
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.65)",
                    background: "#0D0D0F",
                    display: "flex",
                    flexDirection: "column",
                  }
            }
          >
            {/* Floating header */}
            {callIsFloating && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  flexShrink: 0,
                  background: "rgba(0,0,0,0.25)",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: 600,
                  }}
                >
                  #{callChannelName}
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => {
                      const ch = channels.find((c) => c.id === callChannelId);
                      if (ch) {
                        setActiveChannel(ch);
                        setActiveConv(null);
                        setView("channel");
                      }
                    }}
                    title="Return to call"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.45)",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setCallActive(false);
                      setCallRoomName("");
                      setCallChannelId("");
                      setCallChannelName("");
                    }}
                    title="End call"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(239,68,68,0.65)",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0 }}>
              <CallRoom
                channelId={callChannelId}
                roomName={callRoomName}
                isMinimized={false}
                isFloating={callIsFloating}
                onMinimizeToggle={() => {}}
                onLeave={() => {
                  setCallActive(false);
                  setCallRoomName("");
                  setCallChannelId("");
                  setCallChannelName("");
                }}
              />
            </div>
          </div>
        )}

        {/* Channel messages + input */}
        {view === "channel" && (<>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-white/20">
              Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
              <span className="text-3xl">💬</span>
              <span className="text-sm">No messages yet. Say hello!</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-6">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.sender_id === userId}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-end gap-3">
                
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*,video/*,application/*"
            />
        
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || !activeChannel}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20"
            >
              {uploadingFile ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              )}
            </button>
            
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeChannel ? `Message #${activeChannel.name}…` : "Select a channel…"}
              disabled={!activeChannel || uploadingFile}
              rows={1}
              className="flex-1 resize-none overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 disabled:opacity-30 [&::-webkit-scrollbar]:hidden [&::-webkit-resizer]:hidden"
              style={{ scrollbarWidth: "none" }}
            />
            
            <button
              onClick={handleSend}
              disabled={!draft.trim() || !activeChannel || uploadingFile}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="mt-2 pl-1 text-[11px] text-white/20">
            Enter to send · Shift+Enter for new line · Click 📎 to share media
          </p>
        </div>
        </>)}

        {/* Empty state */}
        {!activeChannel && !activeConv && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
            <span className="text-4xl">👋</span>
            <span className="text-sm">Select a channel or DM to start</span>
          </div>
        )}
      </main>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      {((view === "channel" && activeChannel) || (view === "dm" && activeConv)) && (
      <>
      <ResizeHandle onResize={handleRightResize} />
      <aside
        className="flex h-full flex-col border-l border-white/10 bg-[#0D0D0F]"
        style={{ width: rightWidth, minWidth: MIN_SIDE, flexShrink: 0 }}
      >
        {view === "dm" && activeConv ? (
          <>
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-medium text-white/60">Profile</h3>
            </div>
            <DMProfilePanel userId={activeConv.other_user.id} />
          </>
        ) : (
          <>
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-medium text-white/60">Members</h3>
            </div>
            <MemberList
              key={activeChannel?.id ?? "none"}
              channelId={activeChannel?.id ?? null}
              myId={userId ?? ""}
              onDM={(otherId, otherUser) => {
                setPreviewUser(otherUser);
              }}
            />
          </>
        )}
      </aside>
      </>
      )}

      {previewUser && (
        <UserPreviewModal
          user={previewUser}
          onClose={() => setPreviewUser(null)}
          onStartDM={async () => {
            if (!userId) return;
            const convId = await getOrCreateConversation(userId, previewUser.id);
            if (!convId) return;
            setActiveConv({ id: convId, other_user: previewUser });
            setActiveChannel(null);
            setView("dm");
          }}
        />
      )}
    </div>
  );
}