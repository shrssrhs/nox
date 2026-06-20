"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserChannels } from "@/lib/channels";
import { useMessages } from "@/hooks/useMessages";
import type { Message } from "@/hooks/useMessages";
import { CallRoom } from "@/components/CallRoom";
import { FilePreview, CODE_LANGS, getFileExt } from "@/components/FilePreview";
import { SettingsModal } from "@/components/SettingsModal";
import { DMView } from "@/components/DMView";
import { useConversations, getOrCreateConversation } from "@/hooks/useDMs";
import { useUnread } from "@/hooks/useUnread";
import type { Conversation } from "@/hooks/useDMs";
import { ChannelModal } from "@/components/ChannelModal";
import { ChannelSettingsModal } from "@/components/ChannelSettingsModal";
import { DMProfilePanel } from "@/components/DMProfilePanel";
import { UserPreviewModal } from "@/components/UserPreviewModal";
import { FEmoji, StatusDot, statusEmoji } from "@/components/FEmoji";
import { renderMarkdown } from "@/lib/markdown";
import { useReactions } from "@/hooks/useReactions";
import type { ReactionGroup } from "@/hooks/useReactions";
import { useTyping } from "@/hooks/useTyping";
import { useIsMobile } from "@/hooks/useIsMobile";

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
const REPLY_RE = /^«R»(.+?)»(.+?)«end»\n?/;
const CAP_RE   = /^«CAP»(.+?)«end»\n?/;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "💯", "🎉", "👀"];

function MessageBubble({
  msg, isOwn, isPinned, onReply, onPin, onEdit, onDelete, reactions, onReact,
}: {
  msg: Message; isOwn: boolean; isPinned: boolean;
  onReply: (msg: Message) => void;
  onPin: (msgId: string) => void;
  onEdit: (msgId: string, content: string) => Promise<void>;
  onDelete: (msgId: string) => Promise<void>;
  reactions: ReactionGroup[];
  onReact: (emoji: string) => void;
}) {
  const name = msg.profiles?.display_name ?? "Unknown";
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const badges = (msg.profiles as any)?.badges || [];

  // Parse optional reply prefix
  const replyMatch = msg.content.match(REPLY_RE);
  const replyAuthor = replyMatch?.[1];
  const replyPreview = replyMatch?.[2];
  const afterReply = replyMatch ? msg.content.replace(REPLY_RE, "") : msg.content;
  const capMatch = afterReply.match(CAP_RE);
  const caption = capMatch?.[1];
  const text = capMatch ? afterReply.replace(CAP_RE, "") : afterReply;

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImage = /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(text);
  const isVideo = /\.(mp4|webm|ogg|mov)($|\?)/i.test(text);
  const isStorageFile = text.startsWith("http") && text.includes("/storage/v1/object/public/");
  const fileExt = getFileExt(text);
  const isCodeFile = isStorageFile && fileExt in CODE_LANGS;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuVisible(true);
  };

  useEffect(() => {
    const close = () => setMenuVisible(false);
    if (menuVisible) window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuVisible]);

  const handleCopy = async () => {
    if (isImage) {
      try {
        const res = await fetch(text);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        return;
      } catch {}
    }
    navigator.clipboard.writeText(text);
  };

  const menuBtn = "w-full text-left font-mono text-xs text-white/50 hover:text-white hover:bg-white/5 rounded-lg px-3 py-1.5 transition-colors";

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative flex gap-3 select-none ${isOwn ? "flex-row-reverse" : ""}`}
    >
      <Avatar name={name} url={msg.profiles?.avatar_url} size={8} />

      <div className={`flex max-w-[70%] flex-col gap-1 ${isOwn ? "items-end" : ""}`}>
        {/* Header row */}
        <div className="flex items-baseline gap-2">
          {!isOwn && (
            <span className="text-xs font-medium text-white/70 flex items-center gap-1">
              {name}
              {(["owner","investor","admin","mod","verified"] as const)
                .filter(r => badges.includes(r)).slice(0, 1)
                .map(r => {
                  const colors: Record<string, string> = {
                    owner: "#F59E0B", investor: "#8B5CF6", admin: "#EF4444",
                    mod: "#3B82F6", verified: "#10B981",
                  };
                  return (
                    <svg key={r} width="13" height="13" viewBox="0 0 15 15" fill="none">
                      <circle cx="7.5" cy="7.5" r="7.5" fill={colors[r]} />
                      <polyline points="3.8,7.5 6.2,10.2 11.2,4.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  );
                })}
            </span>
          )}
          <span className="text-[11px] text-white/30">{time}</span>
          {isPinned && <span className="text-[11px] text-white/25 select-none">·</span>}
          {isPinned && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/25">
              <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
            </svg>
          )}
        </div>

        {/* Reply quote */}
        {replyAuthor && (
          <div className={`flex items-start gap-1.5 max-w-full ${isOwn ? "flex-row-reverse" : ""}`}>
            <div className="w-px self-stretch bg-white/20 rounded-full flex-shrink-0" />
            <p className="text-[11px] text-white/35 truncate max-w-[220px]">
              <span className="text-white/50 font-medium">{replyAuthor}</span>
              {" "}{replyPreview}
            </p>
          </div>
        )}

        {/* Bubble */}
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
                <button
                  onClick={async () => {
                    if (editValue.trim()) await onEdit(msg.id, editValue.trim());
                    setIsEditing(false);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 px-2 py-1"
                >
                  [save]
                </button>
              </div>
            </div>
          ) : isImage ? (
            <div className="flex flex-col gap-1.5">
              <img
                src={text}
                alt="Shared media"
                onClick={() => setPreviewUrl(text)}
                className="max-w-xs md:max-w-md max-h-72 rounded-xl object-contain border border-white/10 bg-black/20 cursor-zoom-in"
                loading="lazy"
              />
              {caption && <p className="text-sm text-white/70 px-1">{caption}</p>}
            </div>
          ) : isVideo ? (
            <div className="flex flex-col gap-1.5">
              <video src={text} controls className="max-w-xs md:max-w-md max-h-72 rounded-xl border border-white/10 bg-black/20"/>
              {caption && <p className="text-sm text-white/70 px-1">{caption}</p>}
            </div>
          ) : isCodeFile ? (
            <button
              onClick={() => setPreviewUrl(text)}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/8 border border-white/10 px-4 py-3 rounded-xl transition-colors text-left w-full"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/50 font-mono text-[10px] font-bold">
                {fileExt.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate max-w-[180px] text-white/80">
                  {text.split("/").pop()?.split("-").slice(0, 1).join("") + "." + fileExt || "File"}
                </p>
                <p className="text-[10px] text-white/30">{CODE_LANGS[fileExt]} · click to view</p>
              </div>
            </button>
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
            <span className="msg-text">{renderMarkdown(text)}</span>
          )}
        </div>

        {/* Reaction bar */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isOwn ? "justify-end" : ""}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(r.emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${
                  r.hasMe
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                <FEmoji emoji={r.emoji} size={13} />
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {menuVisible && (
        <div
          className="fixed z-50 flex flex-col bg-[#0D0D0F] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-md"
          style={{ top: menuPos.y, left: menuPos.x, minWidth: showPicker ? 180 : 110 }}
          onClick={(e) => e.stopPropagation()}
        >
          {showPicker ? (
            <>
              <button onClick={() => setShowPicker(false)} className="text-left font-mono text-[11px] text-white/25 hover:text-white/60 px-3 py-1.5 transition-colors">‹ back</button>
              <div className="grid grid-cols-4 gap-0.5 p-1">
                {QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(e); setMenuVisible(false); setShowPicker(false); }}
                    className="flex items-center justify-center p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <FEmoji emoji={e} size={22} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { onReply(msg); setMenuVisible(false); }} className={menuBtn}>[reply]</button>
              <button onClick={() => setShowPicker(true)} className={menuBtn}>[react]</button>
              {isOwn && !isImage && !isVideo && !isStorageFile && (
                <button onClick={() => { setIsEditing(true); setMenuVisible(false); }} className={menuBtn}>[edit]</button>
              )}
              <button onClick={() => { onPin(msg.id); setMenuVisible(false); }} className={menuBtn}>
                [{isPinned ? "unpin" : "pin"}]
              </button>
              <button onClick={() => { handleCopy(); setMenuVisible(false); }} className={menuBtn}>[copy]</button>
              {isOwn && <div className="my-1 border-t border-white/5" />}
              {isOwn && (
                <button
                  onClick={() => { onDelete(msg.id); setMenuVisible(false); }}
                  className="w-full text-left font-mono text-xs text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-1.5 transition-colors"
                >[delete]</button>
              )}
            </>
          )}
        </div>
      )}

      {previewUrl && (
        <FilePreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}

// ─── Pinned messages banner ───────────────────────────────────────────────────
function PinnedBanner({ pinnedMessages }: { pinnedMessages: Message[] }) {
  const [idx, setIdx] = useState(0);
  const total = pinnedMessages.length;

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 5000);
    return () => clearInterval(t);
  }, [total]);

  useEffect(() => { setIdx(0); }, [total]);

  const msg = pinnedMessages[idx % total];
  if (!msg) return null;

  const REPLY_RE_LOCAL = /^«R»(.+?)»(.+?)«end»\n?/;
  const text = msg.content.replace(REPLY_RE_LOCAL, "");
  const author = msg.profiles?.display_name ?? "Unknown";
  const isMedia = /\.(jpeg|jpg|gif|png|webp|mp4|webm|ogg|mov)($|\?)/i.test(text);

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.015] px-5 py-2">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 flex-shrink-0">
        <line x1="12" y1="17" x2="12" y2="22"/>
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
      </svg>
      <span className="min-w-0 flex-1 truncate text-[11px] text-white/40">
        <span className="font-medium text-white/55">{author}</span>
        {" · "}
        {isMedia ? "📎 media" : text.slice(0, 80)}
      </span>
      {total > 1 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setIdx((i) => (i - 1 + total) % total)} className="text-white/20 hover:text-white/60 text-xs">‹</button>
          <span className="text-[10px] text-white/25">{idx + 1}/{total}</span>
          <button onClick={() => setIdx((i) => (i + 1) % total)} className="text-white/20 hover:text-white/60 text-xs">›</button>
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
              <span className="absolute -bottom-0.5 -right-0.5">
                <StatusDot status={m.status} size={10} />
              </span>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  
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
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

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

  // Unread counts + browser notifications
  const activeId = view === "channel" ? (activeChannel?.id ?? null) : (activeConv?.id ?? null);
  const { unread, markRead } = useUnread({
    channelIds: channels.map((c) => c.id),
    channelNames: Object.fromEntries(channels.map((c) => [c.id, c.name])),
    convIds: conversations.map((c) => c.id),
    convNames: Object.fromEntries(
      conversations.map((c) => [c.id, c.other_user.display_name ?? "DM"])
    ),
    activeId,
    userId,
  });

  // Messages
  const { messages, sendMessage, editMessage, deleteMessage, loading, bottomRef } = useMessages(
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

  const handleFileUpload = (eOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = eOrFile instanceof File ? eOrFile : (eOrFile.target.files?.[0] ?? null);
    if (!file || !activeChannel?.id) return;
    setComposeFile(file);
    setComposeCaption("");
    setComposeObjUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Reply
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Pins (server-side, Supabase)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeChannel) { setPinnedIds(new Set()); return; }

    supabase
      .from("pins")
      .select("message_id")
      .eq("channel_id", activeChannel.id)
      .then(({ data }) => {
        setPinnedIds(new Set((data ?? []).map((r: any) => r.message_id)));
      });

    const sub = supabase
      .channel(`pins:${activeChannel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pins", filter: `channel_id=eq.${activeChannel.id}` },
        (p) => setPinnedIds((prev) => new Set([...prev, p.new.message_id]))
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pins", filter: `channel_id=eq.${activeChannel.id}` },
        (p) => setPinnedIds((prev) => { const n = new Set(prev); n.delete(p.old.message_id); return n; })
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [activeChannel?.id]);

  const pinnedMessages = messages.filter((m) => pinnedIds.has(m.id));

  const { reactions, toggle: toggleReaction } = useReactions(
    messages.map((m) => m.id),
    userId ?? ""
  );

  const handlePin = useCallback(async (msgId: string) => {
    if (!activeChannel || !userId) return;
    if (pinnedIds.has(msgId)) {
      await supabase.from("pins").delete().eq("message_id", msgId).eq("channel_id", activeChannel.id);
    } else {
      await supabase.from("pins").insert({ message_id: msgId, channel_id: activeChannel.id, pinned_by: userId });
    }
  }, [activeChannel, userId, pinnedIds]);

  // Input
  const [draft, setDraft] = useState("");
  const sending = useRef(false);
  const channelTypingId = view === "channel" ? (activeChannel?.id ?? "") : (activeConv?.id ?? "");
  const { typingUsers: channelTyping, startTyping: chStartTyping, stopTyping: chStopTyping } =
    useTyping(channelTypingId, userId ?? "", profile?.display_name ?? "User");

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    let content = draft.trim();
    if (replyingTo) {
      const author = replyingTo.profiles?.display_name ?? "Unknown";
      const preview = replyingTo.content.replace(REPLY_RE, "").slice(0, 60).replace(/\n/g, " ");
      content = `«R»${author}»${preview}«end»\n${content}`;
      setReplyingTo(null);
    }
    setDraft("");
    await sendMessage(content);
    sending.current = false;
  }, [draft, sendMessage, replyingTo]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Compose overlay (file + caption before send)
  const [composeFile, setComposeFile]       = useState<File | null>(null);
  const [composeCaption, setComposeCaption] = useState("");
  const [composeObjUrl, setComposeObjUrl]   = useState<string | null>(null);

  const handleComposeSend = useCallback(async () => {
    if (!composeFile || !activeChannel?.id) return;
    try {
      setUploadingFile(true);
      const ext  = composeFile.name.split(".").pop() || "bin";
      const base = composeFile.name.startsWith("image") ? "clipboard" : composeFile.name.split("-")[0];
      const path = `${activeChannel.id}/${base}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, composeFile);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(path);
      const content = composeCaption.trim()
        ? `«CAP»${composeCaption.trim()}«end»\n${publicUrl}`
        : publicUrl;
      await sendMessage(content);
    } catch (e) { console.error(e); }
    finally {
      setUploadingFile(false);
      if (composeObjUrl) URL.revokeObjectURL(composeObjUrl);
      setComposeFile(null);
      setComposeCaption("");
      setComposeObjUrl(null);
    }
  }, [composeFile, composeCaption, composeObjUrl, activeChannel, supabase, sendMessage]);

  // Call
  const [callActive, setCallActive] = useState(false);
  const [callRoomName, setCallRoomName] = useState("");
  const [callChannelId, setCallChannelId] = useState("");
  const [callChannelName, setCallChannelName] = useState("");
  const [callParticipantCount, setCallParticipantCount] = useState(0);

  // Inline = viewing the channel where the call is; Floating = everywhere else
  const callIsInline =
    callActive &&
    view === "channel" &&
    activeChannel?.id === callChannelId;
  const callIsFloating = callActive && !callIsInline;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090B] text-white">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      {/* Mobile backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside
        className={`flex h-full flex-col border-r border-white/10 bg-[#0D0D0F] ${
          isMobile
            ? `fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : ""
        }`}
        style={isMobile ? { width: "min(85vw, 320px)" } : { width: leftWidth, minWidth: MIN_SIDE, flexShrink: 0 }}
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

        <nav className={`flex-1 overflow-y-auto p-3 ${isMobile ? "pb-20" : ""}`}>
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
              onClick={() => { setActiveChannel(ch); setActiveConv(null); setView("channel"); markRead(ch.id); if (isMobile) setMobileSidebarOpen(false); }}
              className={`mb-0.5 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                view === "channel" && activeChannel?.id === ch.id
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span><span className="mr-2 opacity-40">#</span>{ch.name}</span>
              {!!unread[ch.id] && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold text-white">
                  {unread[ch.id] > 99 ? "99+" : unread[ch.id]}
                </span>
              )}
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
            return (
              <button
                key={conv.id}
                onClick={() => { setActiveConv(conv); setActiveChannel(null); setView("dm"); markRead(conv.id); if (isMobile) setMobileSidebarOpen(false); }}
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
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <StatusDot status={conv.other_user.status} size={9} />
                  </span>
                </div>
                <span className="truncate flex-1">{conv.other_user.display_name ?? "Unknown"}</span>
                {!!unread[conv.id] && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold text-white flex-shrink-0">
                    {unread[conv.id] > 99 ? "99+" : unread[conv.id]}
                  </span>
                )}
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
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/5"
          >
            <div className="relative">
              <Avatar name={profile?.display_name ?? null} url={profile?.avatar_url} size={8} />
              <span className="absolute -bottom-0.5 -right-0.5">
                <StatusDot status={profile?.status} size={11} />
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

      </aside>

      {!isMobile && <ResizeHandle onResize={handleLeftResize} />}

      {/* ── MAIN CHAT ────────────────────────────────────────────────────── */}
      <main className={`flex min-w-0 flex-1 flex-col ${isMobile ? "pb-[60px]" : ""}`}>
        {/* DM view */}
        {view === "dm" && activeConv && userId && (
          <>
            {isMobile && (
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 shrink-0">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="flex items-center justify-center rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span className="text-sm font-medium text-white/80">{activeConv.other_user.display_name}</span>
              </div>
            )}
            <DMView
              conversationId={activeConv.id}
              userId={userId}
              userName={profile?.display_name ?? "User"}
              otherUser={activeConv.other_user}
            />
          </>
        )}

        {/* Channel header */}
        {view === "channel" && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="mr-1 flex items-center justify-center rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            )}
            <h2 className="font-medium">{activeChannel?.name ?? "—"}</h2>
            {activeChannel?.description && (
              <span className="hidden text-xs text-white/30 sm:block">
                {activeChannel.description}
              </span>
            )}
          </div>

          {activeChannel && (
            <div className="flex items-center gap-2">
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

              <button
                onClick={() => setChannelSettingsOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                title="Channel settings"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
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
                    display: "flex" as const,
                    flexDirection: "column" as const,
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
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                  #{callChannelName}
                  {callParticipantCount > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                      · {callParticipantCount} in call
                    </span>
                  )}
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
                onCountChange={setCallParticipantCount}
                onLeave={() => {
                  setCallActive(false);
                  setCallRoomName("");
                  setCallChannelId("");
                  setCallChannelName("");
                  setCallParticipantCount(0);
                }}
              />
            </div>
          </div>
        )}

        {/* Channel messages + input */}
        {view === "channel" && (<>
        {/* Pinned banner */}
        {pinnedMessages.length > 0 && <PinnedBanner pinnedMessages={pinnedMessages} />}
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-white/20">
              Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
              <FEmoji emoji="💬" size={40} />
              <span className="text-sm">No messages yet. Say hello!</span>
            </div>
          ) : (
            <div className="messages-list flex flex-col">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.sender_id === userId}
                  isPinned={pinnedIds.has(msg.id)}
                  onReply={setReplyingTo}
                  onPin={handlePin}
                  onEdit={editMessage}
                  onDelete={deleteMessage}
                  reactions={reactions[msg.id] ?? []}
                  onReact={(emoji) => toggleReaction(msg.id, emoji)}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/10">
          {replyingTo && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
              <span className="text-[11px] text-white/40 truncate max-w-[80%]">
                <span className="text-white/25 mr-1">↩</span>
                <span className="text-white/55 font-medium">{replyingTo.profiles?.display_name}</span>
                {" · "}{replyingTo.content.replace(REPLY_RE, "").slice(0, 60)}
              </span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-white/25 hover:text-white/60 text-xs ml-2 flex-shrink-0"
              >✕</button>
            </div>
          )}
          <div className="flex items-end gap-3 p-4">
                
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
              onChange={(e) => { setDraft(e.target.value); chStartTyping(); }}
              onKeyDown={handleKeyDown}
              onBlur={chStopTyping}
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
          <div className={`overflow-hidden transition-all duration-200 ${channelTyping.length > 0 ? "max-h-5 mt-1" : "max-h-0"}`}>
            <p className="pl-1 text-[11px] text-white/30 italic">
              {channelTyping.join(", ")} {channelTyping.length === 1 ? "is" : "are"} typing
              <span className="inline-flex gap-0.5 ml-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
            </p>
          </div>
          <p className="mt-1 pl-1 text-[11px] text-white/20">
            Enter to send · Shift+Enter for new line · Click 📎 to share media
          </p>
        </div>
        </>)}

        {/* Empty state */}
        {!activeChannel && !activeConv && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
            <FEmoji emoji="👋" size={48} />
            <span className="text-sm">Select a channel or DM to start</span>
          </div>
        )}
      </main>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      {!isMobile && ((view === "channel" && activeChannel) || (view === "dm" && activeConv)) && (
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

      {/* ── MODALS (outside aside to avoid transform containment) ─────────── */}
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
            if (isMobile) setMobileSidebarOpen(false);
          }}
        />
      )}

      {channelSettingsOpen && activeChannel && userId && (
        <ChannelSettingsModal
          channelId={activeChannel.id}
          userId={userId}
          onClose={() => setChannelSettingsOpen(false)}
          onUpdate={(ch) => {
            setActiveChannel((c) => c ? { ...c, name: ch.name, description: ch.description } : c);
            setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, name: ch.name, description: ch.description } : c));
          }}
          onLeave={() => {
            setChannels((prev) => prev.filter((c) => c.id !== activeChannel.id));
            setActiveChannel(null);
          }}
        />
      )}

      {settingsOpen && userId && (
        <SettingsModal
          userId={userId}
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onUpdate={(p) => setProfile({ display_name: p.display_name, avatar_url: p.avatar_url, status: p.status })}
        />
      )}

      {/* ── COMPOSE OVERLAY ──────────────────────────────────────────────── */}
      {composeFile && composeObjUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-white/10 bg-[#111113] p-4 shadow-2xl">
            {/* Preview */}
            {composeFile.type.startsWith("image/") ? (
              <img
                src={composeObjUrl}
                alt="preview"
                className="max-h-64 w-full rounded-xl object-contain bg-black/30"
              />
            ) : composeFile.type.startsWith("video/") ? (
              <video src={composeObjUrl} controls className="max-h-48 w-full rounded-xl bg-black/30"/>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <span className="text-xl">📎</span>
                <p className="text-sm text-white/60 truncate">{composeFile.name}</p>
              </div>
            )}
            {/* Caption input */}
            <input
              value={composeCaption}
              onChange={(e) => setComposeCaption(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleComposeSend(); }}
              placeholder="Add a caption… (optional)"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20"
              autoFocus
            />
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { if (composeObjUrl) URL.revokeObjectURL(composeObjUrl); setComposeFile(null); setComposeCaption(""); setComposeObjUrl(null); }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleComposeSend}
                disabled={uploadingFile}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm text-white hover:bg-white/15 disabled:opacity-40 transition-colors font-medium"
              >
                {uploadingFile ? "Uploading…" : "Send"}
              </button>
            </div>
          </div>
        </div>
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
            if (isMobile) setMobileSidebarOpen(false);
          }}
        />
      )}

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────────────────── */}
      {isMobile && (
        <nav className="fixed bottom-0 inset-x-0 z-50 flex h-[60px] items-center justify-around border-t border-white/10 bg-[#0D0D0F]">
          {/* Channels */}
          <button
            onClick={() => { setMobileSidebarOpen(true); }}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-white/40 hover:text-white transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-[10px] font-medium tracking-wide">Channels</span>
          </button>

          {/* DMs */}
          <button
            onClick={() => { setMobileSidebarOpen(true); }}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-white/40 hover:text-white transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <span className="text-[10px] font-medium tracking-wide">Messages</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-white/40 hover:text-white transition-colors"
          >
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                </svg>
            }
            <span className="text-[10px] font-medium tracking-wide">Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}