"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface ChannelData {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  mode: "open" | "owner_only" | null;
}

interface Member {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

interface Props {
  channelId: string;
  userId: string;
  onClose: () => void;
  onUpdate: (ch: { id: string; name: string; description: string | null }) => void;
  onLeave: () => void;
}

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const cls = `flex-shrink-0 rounded-full object-cover`;
  const px = size * 4;
  if (url) return <img src={url} alt={name} width={px} height={px} className={`${cls} w-${size} h-${size}`} />;
  const initials = name.slice(0, 1).toUpperCase();
  return (
    <div className={`flex w-${size} h-${size} items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/60`}>
      {initials}
    </div>
  );
}

export function ChannelSettingsModal({ channelId, userId, onClose, onUpdate, onLeave }: Props) {
  const [channel, setChannel]   = useState<ChannelData | null>(null);
  const [members, setMembers]   = useState<Member[]>([]);
  const [tab, setTab]           = useState<"overview" | "members">("overview");
  const [name, setName]         = useState("");
  const [desc, setDesc]         = useState("");
  const [mode, setMode]         = useState<"open" | "owner_only">("open");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "leave" | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isOwner = channel?.created_by === userId;

  useEffect(() => {
    async function load() {
      // Try fetching with mode and created_by
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, description, created_by, mode")
        .eq("id", channelId)
        .single();

      if (!error && data) {
        const ch = data as ChannelData;
        setChannel(ch);
        setName(ch.name);
        setDesc(ch.description ?? "");
        setMode(ch.mode ?? "open");
      } else {
        // Fallback without mode
        const { data: fallback } = await supabase
          .from("channels")
          .select("id, name, description, created_by")
          .eq("id", channelId)
          .single();
        if (fallback) {
          const ch = { ...fallback, mode: null } as ChannelData;
          setChannel(ch);
          setName(ch.name);
          setDesc(ch.description ?? "");
        }
      }

      // Load members
      const { data: mRows } = await supabase
        .from("channel_members")
        .select("user_id, profiles(display_name, avatar_url, username)")
        .eq("channel_id", channelId);

      if (mRows) {
        setMembers(
          mRows.map((r: any) => ({
            user_id: r.user_id,
            display_name: r.profiles?.display_name ?? null,
            avatar_url: r.profiles?.avatar_url ?? null,
            username: r.profiles?.username ?? null,
          }))
        );
      }
    }
    load();
  }, [channelId]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    const payload: Record<string, string | null> = {
      name: name.trim().toLowerCase().replace(/\s+/g, "-"),
      description: desc.trim() || null,
    };

    // Try with mode
    const { data, error } = await supabase
      .from("channels")
      .update({ ...payload, mode })
      .eq("id", channelId)
      .select("id, name, description")
      .single();

    const result = error
      ? (await supabase.from("channels").update(payload).eq("id", channelId).select("id, name, description").single()).data
      : data;

    if (result) {
      setChannel((c) => c ? { ...c, name: result.name, description: result.description, mode } : c);
      onUpdate(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function handleDelete() {
    // Delete messages → pins → members → channel
    await supabase.from("messages").delete().eq("channel_id", channelId);
    await supabase.from("pins").delete().eq("channel_id", channelId);
    await supabase.from("channel_members").delete().eq("channel_id", channelId);
    await supabase.from("channels").delete().eq("id", channelId);
    onLeave();
    onClose();
  }

  async function handleLeave() {
    await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", userId);
    onLeave();
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-md flex-col rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden max-h-[90vh]">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-white/30 hover:text-white/70 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-6 pt-5 pb-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-base text-white/50 font-medium mb-4">
            #
          </div>
          <div className="mb-4 min-w-0">
            <p className="truncate text-sm font-semibold text-white">{channel?.name ?? "…"}</p>
            <p className="text-xs text-white/30">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6">
          {(["overview", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`mr-6 pb-3 text-sm capitalize transition-colors ${
                tab === t
                  ? "border-b-2 border-white text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="overflow-y-auto">
            <div className="space-y-4 px-6 py-5">

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs text-white/40">Channel name</label>
                <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-3">
                  <span className="text-sm text-white/30 mr-1">#</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"))}
                    disabled={!isOwner}
                    className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="channel-name"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs text-white/40">Description</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  disabled={!isOwner}
                  rows={3}
                  maxLength={280}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-scrollbar]:hidden"
                  placeholder="What's this channel about?"
                />
                {isOwner && <p className="mt-1 text-right text-xs text-white/20">{desc.length}/280</p>}
              </div>

              {/* Mode — only show if column exists */}
              {isOwner && channel?.mode !== undefined && (
                <div>
                  <label className="mb-1.5 block text-xs text-white/40">Broadcast mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["open", "owner_only"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          mode === m
                            ? "border-white/20 bg-white/5 text-white"
                            : "border-white/5 bg-transparent text-white/40 hover:border-white/10 hover:text-white/60"
                        }`}
                      >
                        <p className="text-xs font-semibold">
                          {m === "open" ? "Open" : "Owner only"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/30">
                          {m === "open"
                            ? "Everyone can send messages"
                            : "Only you can post, others read"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save */}
              {isOwner && (
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-40"
                >
                  {saved ? "✓ Saved" : saving ? "Saving…" : "Save changes"}
                </button>
              )}

              {/* Danger zone */}
              <div className="border-t border-white/5 pt-4 space-y-2">
                {!isOwner && (
                  confirming === "leave" ? (
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                      <p className="mb-3 text-sm text-white/70">Leave <span className="text-white font-medium">#{channel?.name}</span>? You can rejoin anytime.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirming(null)} className="flex-1 rounded-lg border border-white/10 py-1.5 text-xs text-white/40 hover:text-white">Cancel</button>
                        <button onClick={handleLeave} className="flex-1 rounded-lg bg-orange-500/20 py-1.5 text-xs text-orange-400 hover:bg-orange-500/30">Leave</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming("leave")}
                      className="w-full rounded-xl border border-white/5 py-2.5 text-sm text-white/40 hover:border-orange-500/20 hover:text-orange-400 transition-colors"
                    >
                      Leave channel
                    </button>
                  )
                )}

                {isOwner && (
                  confirming === "delete" ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                      <p className="mb-3 text-sm text-white/70">Delete <span className="text-white font-medium">#{channel?.name}</span>? This removes all messages and cannot be undone.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirming(null)} className="flex-1 rounded-lg border border-white/10 py-1.5 text-xs text-white/40 hover:text-white">Cancel</button>
                        <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-500/20 py-1.5 text-xs text-red-400 hover:bg-red-500/30">Delete</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming("delete")}
                      className="w-full rounded-xl border border-white/5 py-2.5 text-sm text-white/40 hover:border-red-500/20 hover:text-red-400 transition-colors"
                    >
                      Delete channel
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* MEMBERS TAB */}
        {tab === "members" && (
          <div className="overflow-y-auto max-h-[60vh]">
            {members.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-white/20">Loading…</div>
            ) : (
              members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 px-6 py-3 hover:bg-white/3 transition-colors">
                  <Avatar name={m.display_name ?? "?"} url={m.avatar_url} size={8} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{m.display_name ?? "Unknown"}</p>
                    {m.username && <p className="text-xs text-white/30">@{m.username}</p>}
                  </div>
                  {m.user_id === channel?.created_by && (
                    <span className="flex-shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      owner
                    </span>
                  )}
                  {m.user_id === userId && m.user_id !== channel?.created_by && (
                    <span className="flex-shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/25">
                      you
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
