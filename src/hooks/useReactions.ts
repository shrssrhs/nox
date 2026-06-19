"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface ReactionGroup {
  emoji: string;
  count: number;
  hasMe: boolean;
}

function groupRows(rows: { message_id: string; emoji: string; user_id: string }[], userId: string) {
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
  return grouped;
}

export function useReactions(messageIds: string[], userId: string) {
  const [data, setData] = useState<Record<string, ReactionGroup[]>>({});
  const idsKey = messageIds.join(",");

  // Unique channel name per hook instance — avoids conflicts when multiple
  // useReactions calls are active simultaneously (AppLayout + DMView).
  const channelName = useRef(`reactions-${Math.random().toString(36).slice(2)}`);

  const refetch = useCallback(async () => {
    if (!messageIds.length || !userId) return;
    const { data: rows } = await supabase
      .from("reactions")
      .select("message_id, emoji, user_id")
      .in("message_id", messageIds);
    if (rows) setData(groupRows(rows, userId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, userId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Always keep the ref current so the subscription handler calls the latest fetch
  const refetchRef = useRef(refetch);
  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  // Realtime subscription — set up once per mount, torn down on unmount
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(channelName.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" },
        () => refetchRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const toggle = useCallback(async (messageId: string, emoji: string) => {
    const hasMe = data[messageId]?.find((r) => r.emoji === emoji)?.hasMe;
    if (hasMe) {
      await supabase.from("reactions").delete()
        .eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji);
    } else {
      await supabase.from("reactions").insert({ message_id: messageId, user_id: userId, emoji });
    }
    // Immediately reflect the change locally without waiting for the realtime event
    await refetchRef.current();
  }, [data, userId]);

  return { reactions: data, toggle };
}
