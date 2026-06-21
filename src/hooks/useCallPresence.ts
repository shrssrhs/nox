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

/**
 * Discord-style "who's in the call" presence.
 *
 * One shared realtime presence channel (`nox-calls`) for the whole app: every
 * client that is currently in a call tracks itself together with the channelId
 * it's calling in. Everyone subscribed sees the full set, grouped by channel —
 * so you can see who's already in a call *before* you join. Presence is dropped
 * automatically when a client disconnects (closes the tab / loses network).
 *
 * @param self                the local user (null until the profile has loaded)
 * @param activeCallChannelId the channel the local user is currently calling in, or null
 * @returns                   Map of channelId -> participants currently in that call
 */
export function useCallPresence(
  self: Self | null,
  activeCallChannelId: string | null
): Map<string, CallParticipant[]> {
  const [byChannel, setByChannel] = useState<Map<string, CallParticipant[]>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [ready, setReady] = useState(false);

  // ── Subscribe once per user ──────────────────────────────────────────────
  useEffect(() => {
    if (!self?.userId) return;

    const channel = supabase.channel("nox-calls", {
      config: { presence: { key: self.userId } },
    });
    channelRef.current = channel;

    const rebuild = () => {
      const state = channel.presenceState<CallParticipant>();
      const map = new Map<string, CallParticipant[]>();
      for (const key in state) {
        for (const entry of state[key]) {
          if (!entry.channelId) continue;
          const list = map.get(entry.channelId) ?? [];
          // de-dupe by userId (multiple tabs share one identity)
          if (!list.some((p) => p.userId === entry.userId)) list.push(entry);
          map.set(entry.channelId, list);
        }
      }
      setByChannel(map);
    };

    channel
      .on("presence", { event: "sync" }, rebuild)
      .on("presence", { event: "join" }, rebuild)
      .on("presence", { event: "leave" }, rebuild)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setReady(true);
      });

    return () => {
      setReady(false);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [self?.userId]);

  // ── Track / untrack the local user as the call state changes ─────────────
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !ready || !self?.userId) return;

    if (activeCallChannelId) {
      void channel.track({
        userId: self.userId,
        channelId: activeCallChannelId,
        displayName: self.displayName,
        avatarUrl: self.avatarUrl,
      } satisfies CallParticipant);
    } else {
      void channel.untrack();
    }
  }, [ready, activeCallChannelId, self?.userId, self?.displayName, self?.avatarUrl]);

  return byChannel;
}
