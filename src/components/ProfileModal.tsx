"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface Profile {
  display_name: string | null;
  avatar_url:   string | null;
  banner_url:   string | null;
  bio:          string | null;
  status:       string | null;
  username:     string | null;
  email:        string | null;
}

interface ProfileModalProps {
  userId:   string;
  onClose:  () => void;
  onUpdate: (p: Profile) => void;
}

const STATUSES = [
  { emoji: "🟢", label: "Online"          },
  { emoji: "🌙", label: "Do not disturb"  },
  { emoji: "👻", label: "Invisible"       },
  { emoji: "🏖️", label: "Away"            },
];

// ─── Tiny spinner ─────────────────────────────────────────────────────────────
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Upload helper ────────────────────────────────────────────────────────────
async function uploadFile(bucket: string, path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) { console.error(error); return null; }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ProfileModal({ userId, onClose, onUpdate }: ProfileModalProps) {
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [name,       setName]       = useState("");
  const [username,   setUsername]   = useState("");
  const [bio,        setBio]        = useState("");
  const [status,     setStatus]     = useState("🟢 Online");
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);
  const [tab,        setTab]        = useState<"profile" | "account">("profile");

  const avatarRef  = useRef<HTMLInputElement>(null);
  const bannerRef  = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Load
  useEffect(() => {
    supabase.from("profiles")
      .select("display_name, avatar_url, banner_url, bio, status, username, email")
      .eq("id", userId).single()
      .then(({ data }) => {
        if (!data) return;
        const p = data as Profile;
        setProfile(p);
        setName(p.display_name ?? "");
        setUsername(p.username ?? "");
        setBio(p.bio ?? "");
        setStatus(p.status ?? "🟢 Online");
      });
  }, [userId]);

  function handleOverlay(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Avatar upload
  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingA(true);
    const url = await uploadFile("avatars", `avatars/${userId}.${file.name.split(".").pop()}`, file);
    if (url) {
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      setProfile(p => p ? { ...p, avatar_url: url } : p);
    }
    setUploadingA(false);
  }

  // Banner upload
  async function handleBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingB(true);
    const url = await uploadFile("avatars", `banners/${userId}.${file.name.split(".").pop()}`, file);
    if (url) {
      await supabase.from("profiles").update({ banner_url: url }).eq("id", userId);
      setProfile(p => p ? { ...p, banner_url: url } : p);
    }
    setUploadingB(false);
  }

  // Save
  async function handleSave() {
    setSaving(true);
    const { data } = await supabase.from("profiles")
      .update({ display_name: name.trim(), username: username.trim() || null, bio: bio.trim() || null, status })
      .eq("id", userId)
      .select("display_name, avatar_url, banner_url, bio, status, username, email")
      .single();
    if (data) {
      setProfile(data as Profile);
      onUpdate(data as Profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  const statusEmoji = status.split(" ")[0];
  const statusLabel = status.split(" ").slice(1).join(" ");

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-md flex-col rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden">

        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 z-10 text-white/30 hover:text-white/70 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6 pt-5">
          {(["profile", "account"] as const).map(t => (
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

        {/* ── PROFILE TAB ── */}
        {tab === "profile" && (
          <div className="overflow-y-auto">
            {/* Banner */}
            <div className="relative h-28 bg-white/5 cursor-pointer group" onClick={() => bannerRef.current?.click()}>
              {profile?.banner_url
                ? <img src={profile.banner_url} alt="banner" className="h-full w-full object-cover"/>
                : <div className="h-full w-full bg-gradient-to-br from-white/5 to-white/10"/>
              }
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingB
                  ? <Spinner size={24}/>
                  : <span className="text-xs text-white/70">Change banner</span>
                }
              </div>
              <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBanner}/>
            </div>

            {/* Avatar over banner */}
            <div className="relative px-6 pb-4">
              <div className="absolute -top-10 left-6">
                <div className="relative cursor-pointer group" onClick={() => avatarRef.current?.click()}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt={name} className="h-20 w-20 rounded-full object-cover ring-4 ring-[#111113]"/>
                    : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold ring-4 ring-[#111113]">
                        {name.slice(0,1).toUpperCase() || "?"}
                      </div>
                  }
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingA ? <Spinner/> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                  </div>
                  {/* Status dot */}
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#111113] text-[11px]">
                    {statusEmoji}
                  </span>
                </div>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar}/>
              </div>

              {/* Spacer for avatar */}
              <div className="h-12"/>

              {/* Name + username */}
              <div className="mb-1">
                <p className="text-base font-semibold text-white">{name || "—"}</p>
                {username && <p className="text-xs text-white/40">@{username}</p>}
              </div>
              {profile?.email && <p className="mb-4 text-xs text-white/25">{profile.email}</p>}

              {/* Bio preview */}
              {bio && (
                <p className="mb-4 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/60 leading-relaxed">
                  {bio}
                </p>
              )}
            </div>

            {/* Form */}
            <div className="space-y-4 border-t border-white/10 px-6 py-5">

              <div>
                <label className="mb-1.5 block text-xs text-white/40">Display name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/20"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-white/40">Username</label>
                <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-4">
                  <span className="text-sm text-white/30">@</span>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="flex-1 bg-transparent py-2.5 pl-1 text-sm text-white outline-none placeholder:text-white/20"
                    placeholder="username"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-white/40">Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  maxLength={160}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/20 [&::-webkit-scrollbar]:hidden"
                  placeholder="Tell something about yourself…"
                />
                <p className="mt-1 text-right text-xs text-white/20">{bio.length}/160</p>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1.5 block text-xs text-white/40">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(s => {
                    const val = `${s.emoji} ${s.label}`;
                    const active = status === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setStatus(val)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                          active
                            ? "border-white/20 bg-white/10 text-white"
                            : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span>{s.emoji}</span><span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-40"
              >
                {saved ? "✓ Saved" : saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}

        {/* ── ACCOUNT TAB ── */}
        {tab === "account" && (
          <div className="space-y-4 px-6 py-6">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs text-white/40">Email</p>
              <p className="mt-0.5 text-sm text-white">{profile?.email ?? "—"}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs text-white/40">Auth provider</p>
              <p className="mt-0.5 text-sm text-white">GitHub</p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => supabase.auth.signOut().then(() => { window.location.href = "/login"; })}
                className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}