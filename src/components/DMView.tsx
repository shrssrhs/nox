"use client";

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from "react";
import { useDMMessages } from "@/hooks/useDMs";
import type { DMMessage } from "@/hooks/useDMs";
import { createClient } from "@/lib/supabase/client";
import { FilePreview, CODE_LANGS, getFileExt } from "@/components/FilePreview";
import { FEmoji, StatusDot, statusEmoji } from "@/components/FEmoji";

const REPLY_RE = /^«R»(.+?)»(.+?)«end»\n?/;

interface Props {
  conversationId: string;
  userId: string;
  otherUser: {
    display_name: string | null;
    avatar_url:   string | null;
    status:       string | null;
  };
}

function Avatar({ name, url }: { name: string | null; url?: string | null }) {
  const cls = "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium overflow-hidden";
  if (url) return <img src={url} alt={name ?? ""} className={`${cls} object-cover`}/>;
  return <div className={cls}>{(name ?? "?").slice(0, 1).toUpperCase()}</div>;
}

function Bubble({
  msg, isOwn, onReply, onEdit, onDelete,
}: {
  msg: DMMessage; isOwn: boolean;
  onReply: (msg: DMMessage) => void;
  onEdit:  (msgId: string, content: string) => Promise<void>;
  onDelete:(msgId: string) => Promise<void>;
}) {
  const name = msg.profiles?.display_name ?? "Unknown";
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const replyMatch  = msg.content.match(REPLY_RE);
  const replyAuthor = replyMatch?.[1];
  const replyPreview= replyMatch?.[2];
  const text = replyMatch ? msg.content.replace(REPLY_RE, "") : msg.content;

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos]         = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing]     = useState(false);
  const [editValue, setEditValue]     = useState(text);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);

  const isImage       = /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(text);
  const isVideo       = /\.(mp4|webm|ogg|mov)($|\?)/i.test(text);
  const isStorageFile = text.startsWith("http") && text.includes("/storage/v1/object/public/");
  const fileExt       = getFileExt(text);
  const isCodeFile    = isStorageFile && fileExt in CODE_LANGS;

  useEffect(() => {
    const close = () => setMenuVisible(false);
    if (menuVisible) {
      window.addEventListener("click", close);
      window.addEventListener("contextmenu", close);
    }
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menuVisible]);

  const handleCopy = async () => {
    if (isImage) {
      try {
        const res  = await fetch(text);
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
      onContextMenu={(e) => { e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY }); setMenuVisible(true); }}
      className={`flex gap-3 select-none ${isOwn ? "flex-row-reverse" : ""}`}
    >
      <Avatar name={name} url={msg.profiles?.avatar_url}/>

      <div className={`flex max-w-[70%] flex-col gap-1 ${isOwn ? "items-end" : ""}`}>
        <div className="flex items-baseline gap-2">
          {!isOwn && <span className="text-xs font-medium text-white/70">{name}</span>}
          <span className="text-[11px] text-white/30">{time}</span>
        </div>

        {replyAuthor && (
          <div className={`flex items-start gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}>
            <div className="w-px self-stretch bg-white/20 rounded-full flex-shrink-0" />
            <p className="text-[11px] text-white/35 truncate max-w-[200px]">
              <span className="text-white/50 font-medium">{replyAuthor}</span>{" "}{replyPreview}
            </p>
          </div>
        )}

        <div className={`rounded-2xl text-sm leading-relaxed overflow-hidden ${
          isImage || isVideo || isCodeFile || isStorageFile
            ? "bg-transparent p-0"
            : isOwn
              ? "rounded-tr-sm bg-white/10 px-4 py-2.5 text-white"
              : "rounded-tl-sm bg-white/5 px-4 py-2.5 text-white/90"
        }`}>
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
                  onClick={async () => { if (editValue.trim()) await onEdit(msg.id, editValue.trim()); setIsEditing(false); }}
                  className="text-emerald-400 hover:text-emerald-300 px-2 py-1"
                >[save]</button>
              </div>
            </div>
          ) : isImage ? (
            <img
              src={text} alt="Attachment"
              onClick={() => setPreviewUrl(text)}
              className="max-w-xs max-h-64 rounded-xl object-contain border border-white/10 bg-black/20 cursor-zoom-in"
              loading="lazy"
            />
          ) : isVideo ? (
            <video src={text} controls className="max-w-xs max-h-64 rounded-xl border border-white/10 bg-black/20"/>
          ) : isCodeFile ? (
            <button
              onClick={() => setPreviewUrl(text)}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/8 border border-white/10 px-4 py-3 rounded-xl transition-colors text-left w-full"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/50 font-mono text-[10px] font-bold">
                {fileExt.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate max-w-[160px] text-white/80">{fileExt} file</p>
                <p className="text-[10px] text-white/30">{CODE_LANGS[fileExt]} · click to view</p>
              </div>
            </button>
          ) : isStorageFile ? (
            <a href={text} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 rounded-xl transition-colors text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/60">📎</div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-medium truncate max-w-[160px] text-white/80">
                  {text.split("/").pop()?.split("-").slice(1).join("-") || "File"}
                </p>
                <p className="text-[10px] text-white/30">Click to download</p>
              </div>
            </a>
          ) : text}
        </div>
      </div>

      {/* Context menu */}
      {menuVisible && (
        <div
          className="fixed z-50 flex flex-col min-w-[110px] bg-[#0D0D0F] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-md"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { onReply(msg); setMenuVisible(false); }} className={menuBtn}>[reply]</button>
          {isOwn && !isImage && !isVideo && !isStorageFile && (
            <button onClick={() => { setIsEditing(true); setMenuVisible(false); }} className={menuBtn}>[edit]</button>
          )}
          <button onClick={() => { handleCopy(); setMenuVisible(false); }} className={menuBtn}>[copy]</button>
          {isOwn && <div className="my-1 border-t border-white/5" />}
          {isOwn && (
            <button
              onClick={() => { onDelete(msg.id); setMenuVisible(false); }}
              className="w-full text-left font-mono text-xs text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-1.5 transition-colors"
            >[delete]</button>
          )}
        </div>
      )}

      {previewUrl && <FilePreview url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
}

export function DMView({ conversationId, userId, otherUser }: Props) {
  const supabase = createClient();
  const { messages, sendDM, editDM, deleteDM, loading, bottomRef } = useDMMessages(conversationId);
  const [draft, setDraft]           = useState("");
  const [replyingTo, setReplyingTo] = useState<DMMessage | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const sending                     = useRef(false);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    let content = draft.trim();
    if (replyingTo) {
      const author  = replyingTo.profiles?.display_name ?? "Unknown";
      const preview = replyingTo.content.replace(REPLY_RE, "").slice(0, 60).replace(/\n/g, " ");
      content = `«R»${author}»${preview}«end»\n${content}`;
      setReplyingTo(null);
    }
    setDraft("");
    await sendDM(content, userId);
    sending.current = false;
  }, [draft, userId, sendDM, replyingTo]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || sending.current) return;
    sending.current = true;
    try {
      const ext  = file.name.split(".").pop();
      const path = `dm-${conversationId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(path);
      await sendDM(publicUrl, userId);
    } catch (err) {
      console.error("DM upload failed:", err);
    } finally {
      sending.current = false;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [conversationId, userId, sendDM, supabase]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const statusLabel = otherUser.status?.split(" ").slice(1).join(" ") ?? "Online";

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4 flex-shrink-0">
        <div className="relative">
          <Avatar name={otherUser.display_name} url={otherUser.avatar_url}/>
          <span className="absolute -bottom-0.5 -right-0.5">
            <StatusDot status={otherUser.status} size={11} />
          </span>
        </div>
        <div>
          <p className="font-medium text-white">{otherUser.display_name ?? "Unknown"}</p>
          <p className="text-xs text-white/30">{statusLabel}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/20">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/20">
            <Avatar name={otherUser.display_name} url={otherUser.avatar_url}/>
            <p className="text-sm">Start a conversation with <span className="text-white/40">{otherUser.display_name}</span></p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6">
            {messages.map((msg) => (
              <Bubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_id === userId}
                onReply={setReplyingTo}
                onEdit={editDM}
                onDelete={deleteDM}
              />
            ))}
            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 flex-shrink-0">
        {replyingTo && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <span className="text-[11px] text-white/40 truncate max-w-[80%]">
              <span className="text-white/25 mr-1">↩</span>
              <span className="text-white/55 font-medium">{replyingTo.profiles?.display_name}</span>
              {" · "}{replyingTo.content.replace(REPLY_RE, "").slice(0, 60)}
            </span>
            <button onClick={() => setReplyingTo(null)} className="text-white/25 hover:text-white/60 text-xs ml-2 flex-shrink-0">✕</button>
          </div>
        )}
        <div className="flex items-end gap-3 p-4">
          <input type="file" ref={fileInputRef} accept="image/*,video/*,application/*" onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUser.display_name ?? ""}…`}
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <p className="pb-3 pl-5 text-[11px] text-white/20">Enter to send · Shift+Enter for new line</p>
      </div>
    </>
  );
}
