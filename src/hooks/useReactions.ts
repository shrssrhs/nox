"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface ReactionGroup {
  emoji: string;
  count: number;
  hasMe: boolean;
}

export function useReactions(messageIds: string[], userId: string) {
  const [data, setData] = useState<Record<string, ReactionGroup[]>>({});
  const idsKey = messageIds.join(",");

  const refetch = useCallback(async () => {
    if (!messageIds.length || !userId) return;
    const { data: rows } = await supabase
      .from("reactions")
      .select("message_id, emoji, user_id")
      .in("message_id", messageIds);

    if (!rows) return;

    const grouped: Record<string, ReactionGroup[]> = {};
    for (const row of rows) {
      if (!grouped[row.message_id]) grouped[row.message_id] = [];
      const existing = grouped[row.message_id].find((r) => r.emoji === row.emoji);
      if (existing) {
        existing.count++;
        if (row.user_id === userId) existing.hasMe = true;
      } else {
        grouped[row.message_id].push({ emoji: row.emoji, count: 1, hasMe: row.user_id === userId });
      }
    }
    setData(grouped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, userId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Single subscription that refetches on any reaction change
  const channelRef = useRef<string>("");
  useEffect(() => {
    if (!userId || !messageIds.length) return;
    const key = `reactions-${userId}-${messageIds[0]}`;
    if (channelRef.current === key) return;
    channelRef.current = key;

    const sub = supabase
      .channel(key)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => refetch())
      .subscribe();

    return () => { supabase.removeChannel(sub); channelRef.current = ""; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, messageIds[0], refetch]);

  const toggle = useCallback(async (messageId: string, emoji: string) => {
    const hasMe = data[messageId]?.find((r) => r.emoji === emoji)?.hasMe;
    if (hasMe) {
      await supabase.from("reactions").delete()
        .eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji);
    } else {
      await supabase.from("reactions").insert({ message_id: messageId, user_id: userId, emoji });
    }
  }, [data, userId]);

  return { reactions: data, toggle };
}
