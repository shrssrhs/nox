"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { swNotify } from "@/components/PrefsInit";

const supabase = createClient();

function requestNotificationPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

interface UseUnreadOptions {
  channelIds: string[];
  channelNames: Record<string, string>;
  convIds: string[];
  convNames: Record<string, string>;
  activeId: string | null;
  userId: string | null;
}

export function useUnread({
  channelIds,
  channelNames,
  convIds,
  convNames,
  activeId,
  userId,
}: UseUnreadOptions) {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => { requestNotificationPermission(); }, []);

  // Channel subscriptions
  useEffect(() => {
    if (!channelIds.length || !userId) return;

    const sub = supabase
      .channel(`unread-channels-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages",
          filter: `channel_id=in.(${channelIds.join(",")})` },
        (payload) => {
          const { channel_id, sender_id } = payload.new as { channel_id: string; sender_id: string };
          if (sender_id === userId) return;
          if (channel_id === activeIdRef.current) return;

          setUnread((p) => ({ ...p, [channel_id]: (p[channel_id] ?? 0) + 1 }));
          swNotify(`#${channelNames[channel_id] ?? "channel"}`, "New message", `ch-${channel_id}`);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelIds.join(","), userId]);

  // DM subscriptions
  useEffect(() => {
    if (!convIds.length || !userId) return;

    const sub = supabase
      .channel(`unread-dms-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages",
          filter: `conversation_id=in.(${convIds.join(",")})` },
        (payload) => {
          const { conversation_id, sender_id } = payload.new as { conversation_id: string; sender_id: string };
          if (sender_id === userId) return;
          if (conversation_id === activeIdRef.current) return;

          setUnread((p) => ({ ...p, [conversation_id]: (p[conversation_id] ?? 0) + 1 }));
          swNotify(convNames[conversation_id] ?? "Someone", "New message", `dm-${conversation_id}`);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convIds.join(","), userId]);

  const markRead = useCallback((id: string) => {
    setUnread((p) => {
      if (!p[id]) return p;
      const n = { ...p }; delete n[id]; return n;
    });
  }, []);

  return { unread, markRead };
}
