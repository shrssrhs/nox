"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function useTyping(roomId: string, userId: string, displayName: string, kind: "channel" | "dm" = "channel") {
  const [presence, setPresence] = useState<{ roomId: string; kind: string; names: string[] } | null>(null);
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTracking   = useRef(false);

  useEffect(() => {
    if (!roomId || !userId) return;

    const ch = supabase.channel(`${kind}:${roomId}:typing`, {
      config: { private: true, presence: { key: userId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ name: string; typing: boolean }>();
      const names = Object.entries(state)
        .filter(([key]) => key !== userId)
        .flatMap(([, presences]) => presences)
        .filter((p) => p.typing)
        .map((p) => p.name)
        .filter(Boolean);
      setPresence({roomId,kind,names:[...new Set(names)]});
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      clearTimeout(timeoutRef.current);
      supabase.removeChannel(ch);
      channelRef.current = null;
      isTracking.current = false;
    };
  }, [roomId, userId, kind]);

  const stopTyping = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (!channelRef.current || !isTracking.current) return;
    void channelRef.current.untrack();
    isTracking.current = false;
  }, []);

  const startTyping = useCallback(() => {
    if (!channelRef.current) return;
    if (!isTracking.current) void channelRef.current.track({ name: displayName, typing: true });
    isTracking.current = true;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(stopTyping, 3000);
  }, [displayName, stopTyping]);
  const typingUsers = presence?.roomId === roomId && presence.kind === kind ? presence.names : [];

  return { typingUsers, startTyping, stopTyping };
}
