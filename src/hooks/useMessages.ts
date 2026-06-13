"use client";

// hooks/useMessages.ts
// Usage: const { messages, sendMessage } = useMessages(channelId)

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient(); // создаём один раз вне хука

export interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

export function useMessages(channelId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    if (!channelId) return;

    async function fetchMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles(display_name, avatar_url)")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data as Message[]) ?? []);
      setLoading(false);
    }

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch full row with profile join
          const { data } = await supabase
            .from("messages")
            .select("*, profiles(display_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (data) setMessages((prev) => [...prev, data as Message]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !content.trim()) return;

    await supabase.from("messages").insert({
      channel_id: channelId,
      sender_id: user.id,
      content: content.trim(),
    });
  }

  return { messages, sendMessage, loading, bottomRef };
}