"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface CallParticipant {
  userId: string;
  channelId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Self {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Presence is private to each channel; no app-wide call roster is broadcast. */
export function useCallPresence(self: Self | null, activeCallChannelId: string | null, channelIds: string[]): Map<string, CallParticipant[]> {
  const [byChannel, setByChannel] = useState<Map<string, CallParticipant[]>>(new Map());
  const subscriptions = useRef(new Map<string, ReturnType<typeof supabase.channel>>());
  const activeRef = useRef(activeCallChannelId);
  const selfRef = useRef(self);
  const idsKey = [...channelIds].sort().join(",");
  useEffect(() => { activeRef.current = activeCallChannelId; selfRef.current = self; }, [activeCallChannelId, self]);
  useEffect(() => {
    if (!self?.userId) return;
    const local = new Map<string, ReturnType<typeof supabase.channel>>();
    for (const channelId of idsKey.split(",").filter(Boolean)) {
      const channel = supabase.channel(`channel:${channelId}:call`, { config: { private: true, presence: { key: self.userId } } });
      local.set(channelId, channel);
      channel.on("presence", { event: "sync" }, () => {
        const entries = Object.values(channel.presenceState<CallParticipant>()).flat();
        const unique = [...new Map(entries.map((entry) => [entry.userId, entry])).values()];
        setByChannel((previous) => new Map(previous).set(channelId, unique));
      }).subscribe((status) => {
        if (status === "SUBSCRIBED" && activeRef.current === channelId && selfRef.current) {
          const current = selfRef.current;
          void channel.track({ userId: current.userId, channelId, displayName: current.displayName, avatarUrl: current.avatarUrl });
        }
      });
    }
    subscriptions.current = local;
    return () => { for (const channel of local.values()) void supabase.removeChannel(channel); subscriptions.current = new Map(); };
  }, [idsKey, self?.userId]);
  useEffect(() => {
    for (const [channelId, channel] of subscriptions.current) {
      if (activeCallChannelId === channelId && self) void channel.track({ userId: self.userId, channelId, displayName: self.displayName, avatarUrl: self.avatarUrl });
      else void channel.untrack();
    }
  }, [activeCallChannelId, self?.userId, self?.displayName, self?.avatarUrl]);
  return byChannel;
}
