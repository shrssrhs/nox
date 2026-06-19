"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function useTyping(roomId: string, userId: string, displayName: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTracking   = useRef(false);

  useEffect(() => {
    if (!roomId || !userId) return;

    const ch = supabase.channel(`typing:${roomId}`, {
      config: { presence: { key: userId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ name: string; typing: boolean }>();
      const names = Object.entries(state)
        .filter(([key]) => key !== userId)
        .flatMap(([, presences]) => presences)
        .filter((p) => p.typing)
        .map((p) => p.name)
        .filter(Boolean);
      setTypingUsers(names);
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      clearTimeout(timeoutRef.current);
      supabase.removeChannel(ch);
      channelRef.current = null;
      isTracking.current = false;
    };
  }, [roomId, userId]);

  function startTyping() {
    if (!channelRef.current) return;
    channelRef.current.track({ name: displayName, typing: true });
    isTracking.current = true;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(stopTyping, 3000);
  }

  function stopTyping() {
    clearTimeout(timeoutRef.current);
    if (!channelRef.current || !isTracking.current) return;
    channelRef.current.untrack();
    isTracking.current = false;
  }

  return { typingUsers, startTyping, stopTyping };
}
