"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FEmoji, statusEmoji } from "@/components/FEmoji";

const supabase = createClient();

const BADGE_COLORS: Record<string, string> = {
  owner: "#F59E0B",
  investor: "#8B5CF6",
  admin: "#EF4444",
  mod: "#3B82F6",
  verified: "#10B981",
};

const ROLE_PRIORITY = ["owner", "investor", "admin", "mod", "verified"];

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  status: string | null;
  badges: string[] | null;
}

interface Props {
  userId: string;
}

export function DMProfilePanel({ userId }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, banner_url, bio, status, badges")
        .eq("id", userId)
        .single();

      if (data) {
        setProfile(data as Profile);
        return;
      }

      if (!error) return;

      const { data: fallback } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, banner_url, bio, status")
        .eq("id", userId)
        .single();

      if (fallback) {
        setProfile({ ...(fallback as Profile), badges: null });
      } else {
        console.error("Failed to load DM profile:", error.message);
      }
    }

    loadProfile();
  }, [userId]);

  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-white/20">
        Loading…
      </div>
    );
  }

  const initials = (profile.display_name ?? "?").slice(0, 1).toUpperCase();
  const statusText = profile.status?.split(" ").slice(1).join(" ") ?? "Online";
  const badges = profile.badges ?? [];
  const topBadge = ROLE_PRIORITY.find((r) => badges.includes(r));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="h-24 w-full shrink-0 overflow-hidden border-b border-white/5 bg-zinc-800">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
        ) : profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-40 blur-md"
          />
        ) : null}
      </div>

      <div className="relative px-4 pb-4">
        <div className="-mt-8 mb-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full border-4 border-[#0D0D0F] object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#0D0D0F] bg-zinc-800 text-xl font-bold text-white/60">
              {initials}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-base font-semibold text-white">
              {profile.display_name ?? "Unknown"}
              {topBadge && (
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="7.5" fill={BADGE_COLORS[topBadge]} />
                  <polyline
                    points="3.8,7.5 6.2,10.2 11.2,4.8"
                    stroke="#fff"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </h3>
            {profile.username && (
              <p className="mt-0.5 text-xs text-white/40">@{profile.username}</p>
            )}
          </div>

          {profile.bio && (
            <p className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-white/70">
              {profile.bio}
            </p>
          )}

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
              Status
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-white/70">
              <FEmoji emoji={statusEmoji(profile.status)} size={13} />
              <span>{statusText}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
