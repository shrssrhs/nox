"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusDot } from "@/components/FEmoji";

const supabase = createClient();

// ─── localStorage helpers ─────────────────────────────────────────────────────
function getPref<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  const v = localStorage.getItem(key);
  if (v === null) return def;
  try { return JSON.parse(v) as T; } catch { return def; }
}
function setPref<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val));
}

export interface NoxPrefs {
  joinSound: boolean;
  desktopNotifs: boolean;
  messageSound: boolean;
  compactMode: boolean;
  fontSize: "sm" | "base" | "lg";
}

export function loadPrefs(): NoxPrefs {
  return {
    joinSound:       getPref("nox_join_sound", true),
    desktopNotifs:   getPref("nox_desktop_notifs", true),
    messageSound:    getPref("nox_message_sound", false),
    compactMode:     getPref("nox_compact_mode", false),
    fontSize:        getPref("nox_font_size", "base"),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = "profile" | "notifications" | "appearance" | "audio" | "account";

interface Profile {
  display_name: string | null;
  avatar_url:   string | null;
  banner_url:   string | null;
  bio:          string | null;
  status:       string | null;
  username:     string | null;
  email:        string | null;
}

interface SidebarProfile {
  display_name: string | null;
  avatar_url: string | null;
  status: string | null;
}

interface Props {
  userId: string;
  profile: SidebarProfile | null;
  onClose: () => void;
  onUpdate: (p: Profile) => void;
}

const STATUSES = [
  { emoji: "🟢", label: "Online"         },
  { emoji: "🌙", label: "Do not disturb" },
  { emoji: "👻", label: "Invisible"      },
  { emoji: "🏖️", label: "Away"           },
];

// ─── Icons ───────────────────────────────────────────────────────────────────
function IconPerson() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function IconPalette() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
    </svg>
  );
}
function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? "bg-white/80" : "bg-white/15"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-[#111113] shadow-lg transform transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ─── SettingsRow ──────────────────────────────────────────────────────────────
function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-xs text-white/30 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── FileUpload helper ────────────────────────────────────────────────────────
async function uploadFile(bucket: string, path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// ─── Sections ─────────────────────────────────────────────────────────────────
function ProfileSection({ userId, profile: initProfile, onUpdate, onProfileChange }: {
  userId: string;
  profile: Profile | null;
  onUpdate: (p: Profile) => void;
  onProfileChange: (p: Profile) => void;
}) {
  const [name,       setName]       = useState(initProfile?.display_name ?? "");
  const [username,   setUsername]   = useState(initProfile?.username ?? "");
  const [bio,        setBio]        = useState(initProfile?.bio ?? "");
  const [status,     setStatus]     = useState(initProfile?.status ?? "🟢 Online");
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);
  const [localProfile, setLocalProfile] = useState<Profile | null>(initProfile);

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  // Sync form when cached profile arrives from parent (no extra DB call)
  useEffect(() => {
    if (!initProfile) return;
    setLocalProfile(initProfile);
    setName(initProfile.display_name ?? "");
    setUsername(initProfile.username ?? "");
    setBio(initProfile.bio ?? "");
    setStatus(initProfile.status ?? "🟢 Online");
  }, [initProfile]);

  function updateLocal(p: Profile) {
    setLocalProfile(p);
    onProfileChange(p);  // update parent cache
    onUpdate(p);         // update sidebar
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingA(true);
    const url = await uploadFile("avatars", `avatars/${userId}.${file.name.split(".").pop()}`, file);
    if (url) {
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      const updated = { ...localProfile!, avatar_url: url };
      updateLocal(updated);
    }
    setUploadingA(false);
  }

  async function handleBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingB(true);
    const url = await uploadFile("avatars", `banners/${userId}.${file.name.split(".").pop()}`, file);
    if (url) {
      await supabase.from("profiles").update({ banner_url: url }).eq("id", userId);
      updateLocal({ ...localProfile!, banner_url: url });
    }
    setUploadingB(false);
  }

  async function handleSave() {
    setSaving(true);
    const { data } = await supabase.from("profiles")
      .update({ display_name: name.trim(), username: username.trim() || null, bio: bio.trim() || null, status })
      .eq("id", userId)
      .select("display_name, avatar_url, banner_url, bio, status, username, email")
      .single();
    if (data) { updateLocal(data as Profile); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  }

  return (
    <div>
      {/* Banner */}
      <div
        className="relative h-32 cursor-pointer group rounded-xl overflow-hidden mb-4"
        onClick={() => bannerRef.current?.click()}
      >
        {localProfile?.banner_url
          ? <img src={localProfile.banner_url} className="h-full w-full object-cover" alt="banner"/>
          : <div className="h-full w-full bg-gradient-to-br from-white/5 to-white/10"/>
        }
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white/70">
          {uploadingB ? "Uploading…" : "Change banner"}
        </div>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBanner}/>
      </div>

      {/* Avatar */}
      <div className="flex items-end gap-4 mb-6">
        <div className="relative cursor-pointer group" onClick={() => avatarRef.current?.click()}>
          {localProfile?.avatar_url
            ? <img src={localProfile.avatar_url} alt={name} className="h-20 w-20 rounded-full object-cover ring-4 ring-[#111113]"/>
            : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold ring-4 ring-[#111113]">
                {name.slice(0,1).toUpperCase() || "?"}
              </div>
          }
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingA ? "…" : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#111113]">
            <StatusDot status={status} size={12}/>
          </span>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar}/>
        </div>
        <div>
          <p className="text-base font-semibold text-white">{name || "—"}</p>
          {username && <p className="text-xs text-white/40">@{username}</p>}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
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
                    active ? "border-white/20 bg-white/10 text-white" : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <StatusDot status={s.emoji} size={10}/><span>{s.label}</span>
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
  );
}

function NotificationsSection({ prefs, onChange }: { prefs: NoxPrefs; onChange: (k: keyof NoxPrefs, v: any) => void }) {
  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    if (p === "granted") onChange("desktopNotifs", true);
    else onChange("desktopNotifs", false);
  }

  return (
    <div className="space-y-1">
      <div className="rounded-xl border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
        <div className="px-4">
          <SettingsRow label="Join sound" hint="Play a sound when someone joins a call">
            <Toggle checked={prefs.joinSound} onChange={v => onChange("joinSound", v)}/>
          </SettingsRow>
        </div>
        <div className="px-4">
          <SettingsRow label="Message sound" hint="Play a sound for new messages">
            <Toggle checked={prefs.messageSound} onChange={v => onChange("messageSound", v)}/>
          </SettingsRow>
        </div>
        <div className="px-4">
          <SettingsRow label="Desktop notifications" hint="Show system notifications when app is in background">
            <Toggle
              checked={prefs.desktopNotifs}
              onChange={(v) => { if (v) requestNotifPermission(); else onChange("desktopNotifs", false); }}
            />
          </SettingsRow>
        </div>
      </div>
    </div>
  );
}

function AppearanceSection({ prefs, onChange }: { prefs: NoxPrefs; onChange: (k: keyof NoxPrefs, v: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
        <div className="px-4">
          <SettingsRow label="Compact mode" hint="Reduce spacing between messages">
            <Toggle checked={prefs.compactMode} onChange={v => onChange("compactMode", v)}/>
          </SettingsRow>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-3.5">
        <p className="text-sm text-white mb-3">Message font size</p>
        <div className="flex gap-2">
          {(["sm", "base", "lg"] as const).map(size => (
            <button
              key={size}
              onClick={() => onChange("fontSize", size)}
              className={`flex-1 rounded-xl border py-2 transition-colors ${
                prefs.fontSize === size
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/5 bg-white/3 text-white/40 hover:text-white/70"
              }`}
              style={{ fontSize: size === "sm" ? 11 : size === "base" ? 13 : 16 }}
            >
              Aa
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-white/20 px-1">
          <span>Small</span><span>Medium</span><span>Large</span>
        </div>
      </div>
    </div>
  );
}

function AudioVideoSection() {
  const [mics,     setMics]     = useState<MediaDeviceInfo[]>([]);
  const [cams,     setCams]     = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selMic,   setSelMic]   = useState("");
  const [selCam,   setSelCam]   = useState("");
  const [selSpk,   setSelSpk]   = useState("");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => {});
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMics(devices.filter(d => d.kind === "audioinput"));
        setCams(devices.filter(d => d.kind === "videoinput"));
        setSpeakers(devices.filter(d => d.kind === "audiooutput"));
        setSelMic(getPref("nox_mic", "default"));
        setSelCam(getPref("nox_cam", "default"));
        setSelSpk(getPref("nox_spk", "default"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function DeviceSelect({ label, devices, value, prefKey, onChange }: {
    label: string; devices: MediaDeviceInfo[]; value: string; prefKey: string; onChange: (v: string) => void;
  }) {
    return (
      <div className="px-4 py-3.5">
        <p className="text-xs text-white/40 mb-2">{label}</p>
        {loading ? (
          <p className="text-sm text-white/20">Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-white/20">No {label.toLowerCase()} found</p>
        ) : (
          <select
            value={value}
            onChange={e => { onChange(e.target.value); setPref(prefKey, e.target.value); }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="default">System default</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
      <DeviceSelect label="Microphone" devices={mics} value={selMic} prefKey="nox_mic" onChange={setSelMic}/>
      <DeviceSelect label="Camera"     devices={cams} value={selCam} prefKey="nox_cam" onChange={setSelCam}/>
      <DeviceSelect label="Speakers"   devices={speakers} value={selSpk} prefKey="nox_spk" onChange={setSelSpk}/>
    </div>
  );
}

function AccountSection({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
        <div className="px-4 py-3.5">
          <p className="text-xs text-white/40 mb-1">Email</p>
          <p className="text-sm text-white">{email ?? "—"}</p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs text-white/40 mb-1">Auth provider</p>
          <p className="text-sm text-white">GitHub</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-3.5">
        <p className="text-xs text-white/40 mb-1">Version</p>
        <p className="text-sm text-white/60 font-mono">Nox 1.0.0-alpha</p>
      </div>

      <button
        onClick={onSignOut}
        className="w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
      >
        Sign out
      </button>
    </div>
  );
}

// ─── NAV items ────────────────────────────────────────────────────────────────
const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "profile",       label: "My Profile",          icon: <IconPerson/> },
  { id: "notifications", label: "Notifications & Sounds", icon: <IconBell/> },
  { id: "appearance",    label: "Appearance",           icon: <IconPalette/> },
  { id: "audio",         label: "Audio & Video",        icon: <IconMic/> },
  { id: "account",       label: "Account",              icon: <IconShield/> },
];

// ─── Main modal ───────────────────────────────────────────────────────────────
export function SettingsModal({ userId, profile: sidebarProfile, onClose, onUpdate }: Props) {
  const [section,    setSection]    = useState<Section>("profile");
  const [sectionKey, setSectionKey] = useState(0);
  const [prefs,      setPrefs]      = useState<NoxPrefs>(loadPrefs);

  // ── Single profile fetch on open — cached for the lifetime of the modal ──
  const [fullProfile, setFullProfile] = useState<Profile | null>(null);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("display_name, avatar_url, banner_url, bio, status, username, email")
      .eq("id", userId)
      .single()
      .then(({ data }) => { if (data) setFullProfile(data as Profile); });
  }, [userId]);

  // Update cache when ProfileSection saves / uploads
  function handleProfileChange(p: Profile) {
    setFullProfile(p);
  }

  // Displayed profile in sidebar: use full profile once loaded, fall back to sidebar prop
  const navProfile = fullProfile ?? sidebarProfile;

  function changeSection(s: Section) {
    setSection(s);
    setSectionKey(k => k + 1); // triggers re-animation
  }

  function handlePref<K extends keyof NoxPrefs>(key: K, val: NoxPrefs[K]) {
    // Convert camelCase key to snake_case for localStorage
    const lsKey = "nox_" + key.replace(/([A-Z])/g, m => "_" + m.toLowerCase());
    setPref(lsKey, val);
    setPrefs(p => ({ ...p, [key]: val }));
    if (key === "compactMode")  document.body.classList.toggle("nox-compact", val as boolean);
    if (key === "fontSize")     document.body.setAttribute("data-font-size", val as string);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const sectionTitle = NAV.find(n => n.id === section)?.label ?? "";

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm settings-panel">
      {/* ── Left nav ── */}
      <div className="flex w-64 flex-col border-r border-white/10 bg-[#0D0D0F] py-6 flex-shrink-0 settings-nav">
        {/* Profile card */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {navProfile?.avatar_url
                ? <img src={navProfile.avatar_url} className="h-12 w-12 rounded-full object-cover" alt=""/>
                : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/60">
                    {(navProfile?.display_name ?? "?").slice(0,1).toUpperCase()}
                  </div>
              }
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0D0D0F]">
                <StatusDot status={navProfile?.status} size={10}/>
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{navProfile?.display_name ?? "…"}</p>
              <p className="text-xs text-white/30">{navProfile?.status?.split(" ").slice(1).join(" ") ?? "Online"}</p>
            </div>
          </div>
        </div>

        <div className="mx-5 mb-4 border-t border-white/5"/>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => changeSection(item.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 text-left ${
                section === item.id
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/70"
              }`}
            >
              <span className="flex-shrink-0 transition-opacity duration-150">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Close */}
        <div className="px-3 mt-4">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/25 hover:text-white/50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#111113]">
        {/* Section header */}
        <div className="flex items-center border-b border-white/10 px-8 py-5 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{sectionTitle}</h2>
        </div>

        {/* Scrollable content — key triggers re-animation on section switch */}
        <div key={sectionKey} className="flex-1 overflow-y-auto px-8 py-6 [&::-webkit-scrollbar]:hidden settings-section">
          <div className="max-w-lg">
            {section === "profile" && (
              <ProfileSection
                userId={userId}
                profile={fullProfile}
                onUpdate={onUpdate}
                onProfileChange={handleProfileChange}
              />
            )}
            {section === "notifications" && (
              <NotificationsSection prefs={prefs} onChange={handlePref}/>
            )}
            {section === "appearance" && (
              <AppearanceSection prefs={prefs} onChange={handlePref}/>
            )}
            {section === "audio" && (
              <AudioVideoSection/>
            )}
            {section === "account" && (
              <AccountSection email={fullProfile?.email ?? null} onSignOut={handleSignOut}/>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
