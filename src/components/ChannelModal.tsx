"use client";

// components/ChannelModal.tsx
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_member?: boolean;
}

interface Props {
  userId: string;
  onClose: () => void;
  onJoin: (channel: Channel) => void;
}

export function ChannelModal({ userId, onClose, onJoin }: Props) {
  const [query,    setQuery]    = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newDesc,  setNewDesc]  = useState("");
  const [tab,      setTab]      = useState<"browse" | "create">("browse");
  const inputRef   = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: allChannels } = await supabase
        .from("channels")
        .select("id, name, description")
        .order("name");

      const { data: myMemberships } = await supabase
        .from("channel_members")
        .select("channel_id")
        .eq("user_id", userId);

      const myIds = new Set((myMemberships ?? []).map((m: any) => m.channel_id));

      setChannels((allChannels ?? []).map((ch: any) => ({
        ...ch,
        is_member: myIds.has(ch.id),
      })));
      setLoading(false);
    }
    load();
  }, [userId]);

  const filtered = channels.filter((ch) =>
    ch.name.toLowerCase().includes(query.toLowerCase()) ||
    ch.description?.toLowerCase().includes(query.toLowerCase())
  );

  async function handleJoin(ch: Channel) {
    if (!ch.is_member) {
      await supabase.from("channel_members").insert({
        channel_id: ch.id,
        user_id: userId,
        role: "member",
      });
    }
    onJoin({ ...ch, is_member: true });
    onClose();
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: ch } = await supabase
      .from("channels")
      .insert({
        name: newName.trim().toLowerCase().replace(/\s+/g, "-"),
        description: newDesc.trim() || null,
        created_by: userId,
      })
      .select("id, name, description")
      .single();

    if (ch) {
      await supabase.from("channel_members").insert({
        channel_id: ch.id,
        user_id: userId,
        role: "owner",
      });
      onJoin(ch);
      onClose();
    }
    setCreating(false);
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-24"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(["browse", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm transition-colors ${
                tab === t ? "border-b-2 border-white text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "browse" ? "Browse channels" : "Create new"}
            </button>
          ))}
        </div>

        {/* BROWSE */}
        {tab === "browse" && (
          <>
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
                placeholder="Search channels…"
                className="flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-white/25"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-white/30 hover:text-white/60">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-white/20">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-white/20">
                  <span className="text-2xl">#</span>
                  <span className="text-sm">No channels found</span>
                  <button
                    onClick={() => { setTab("create"); setNewName(query); }}
                    className="mt-1 text-xs text-white/40 hover:text-white/70 underline"
                  >
                    Create "{query}"
                  </button>
                </div>
              ) : (
                filtered.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleJoin(ch)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm text-white/40">#</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{ch.name}</p>
                      {ch.description && <p className="truncate text-xs text-white/30">{ch.description}</p>}
                    </div>
                    <span className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-xs ${
                      ch.is_member ? "bg-white/5 text-white/30" : "bg-white/10 text-white/70"
                    }`}>
                      {ch.is_member ? "Joined" : "Join"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* CREATE */}
        {tab === "create" && (
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs text-white/40">Channel name</label>
              <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-4">
                <span className="text-sm text-white/30">#</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"))}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="flex-1 bg-transparent py-2.5 pl-1 text-sm text-white outline-none placeholder:text-white/20"
                  placeholder="channel-name"
                  autoFocus
                />
              </div>
              <p className="mt-1 text-xs text-white/20">Lowercase, numbers and dashes only</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-white/40">Description <span className="text-white/20">(optional)</span></label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 placeholder:text-white/20"
                placeholder="What's this channel about?"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create channel"}
            </button>
          </div>
        )}

        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-xs text-white/20">Press Esc to close</p>
        </div>
      </div>
    </div>
  );
}