"use client";

import { useState, useCallback, KeyboardEvent, useRef } from "react";
import { useDMMessages } from "@/hooks/useDMs";
import type { DMMessage } from "@/hooks/useDMs";
import { createClient } from "@/lib/supabase/client";

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

function Bubble({ msg, isOwn }: { msg: DMMessage; isOwn: boolean }) {
  const name = msg.profiles?.display_name ?? "Unknown";
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Проверка: является ли сообщение URL-ссылкой на вложение изображения
  const isImg = msg.content.startsWith("http") && (
    msg.content.includes(".png") || 
    msg.content.includes(".jpg") || 
    msg.content.includes(".jpeg") || 
    msg.content.includes("attachments")
  );

  return (
    <div className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
      <Avatar name={name} url={msg.profiles?.avatar_url}/>
      <div className={`flex max-w-[70%] flex-col gap-1 ${isOwn ? "items-end" : ""}`}>
        <div className="flex items-baseline gap-2">
          {!isOwn && <span className="text-xs font-medium text-white/70">{name}</span>}
          <span className="text-[11px] text-white/30">{time}</span>
        </div>
        {isImg ? (
          <img 
            src={msg.content} 
            alt="DM Attachment" 
            className="mt-1 max-h-64 rounded-2xl object-contain border border-white/5 bg-white/5 shadow-lg"
          />
        ) : (
          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
            isOwn
              ? "rounded-tr-sm bg-white/10 text-white"
              : "rounded-tl-sm bg-white/5 text-white/90"
          }`}>
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}

export function DMView({ conversationId, userId, otherUser }: Props) {
  const supabase = createClient();
  const { messages, sendDM, loading, bottomRef } = useDMMessages(conversationId);
  const [draft,   setDraft]   = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sending = { current: false };

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    const text = draft;
    setDraft("");
    await sendDM(text, userId);
    sending.current = false;
  }, [draft, userId, sendDM]);

  // Обработчик загрузки картинок в DM через Supabase Storage
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || sending.current) return;

    sending.current = true;
    try {
      const ext = file.name.split(".").pop();
      const path = `dm-${conversationId}/${Date.now()}.${ext}`;
      
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(path);
      await sendDM(publicUrl, userId);
    } catch (err) {
      console.error("DM upload execution failed:", err);
    } finally {
      sending.current = false;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [conversationId, userId, sendDM, supabase]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const statusEmoji = otherUser.status?.split(" ")[0] ?? "🟢";
  const statusLabel = otherUser.status?.split(" ").slice(1).join(" ") ?? "Online";

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <div className="relative">
          <Avatar name={otherUser.display_name} url={otherUser.avatar_url}/>
          <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">{statusEmoji}</span>
        </div>
        <div>
          <p className="font-medium text-white">{otherUser.display_name ?? "Unknown"}</p>
          <p className="text-xs text-white/30">{statusLabel}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
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
              <Bubble key={msg.id} msg={msg} isOwn={msg.sender_id === userId}/>
            ))}
            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-end gap-3">
          {/* Скрытый инпут файлов */}
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          
          {/* Кнопка скрепки */}
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
            onChange={e => setDraft(e.target.value)}
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
        <p className="mt-2 pl-1 text-[11px] text-white/20">Enter to send · Shift+Enter for new line</p>
      </div>
    </>
  );
}