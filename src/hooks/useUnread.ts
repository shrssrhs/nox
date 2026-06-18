"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function requestNotificationPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function fireNotification(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (document.hasFocus()) return; // don't spam when window is focused
  new Notification(title, { body, icon: "/favicon.ico", silent: false });
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

  // Request permission once
  useEffect(() => { requestNotificationPermission(); }, []);

  // Channel message subscriptions
  useEffect(() => {
    if (!channelIds.length || !userId) return;

    const chSub = supabase
      .channel(`unread-channels-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=in.(${channelIds.join(",")})`,
        },
        (payload) => {
          const { channel_id, sender_id } = payload.new as { channel_id: string; sender_id: string };
          if (sender_id === userId) return;
          if (channel_id === activeIdRef.current) return;

          setUnread((prev) => ({
            ...prev,
            [channel_id]: (prev[channel_id] ?? 0) + 1,
          }));

          const name = channelNames[channel_id] ?? "channel";
          fireNotification(`#${name}`, "New message");
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(chSub); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelIds.join(","), userId]);

  // DM subscriptions
  useEffect(() => {
    if (!convIds.length || !userId) return;

    const dmSub = supabase
      .channel(`unread-dms-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=in.(${convIds.join(",")})`,
        },
        (payload) => {
          const { conversation_id, sender_id } = payload.new as { conversation_id: string; sender_id: string };
          if (sender_id === userId) return;
          if (conversation_id === activeIdRef.current) return;

          setUnread((prev) => ({
            ...prev,
            [conversation_id]: (prev[conversation_id] ?? 0) + 1,
          }));

          const name = convNames[conversation_id] ?? "someone";
          fireNotification(name, "New message");
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(dmSub); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convIds.join(","), userId]);

  const markRead = useCallback((id: string) => {
    setUnread((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return { unread, markRead };
}
