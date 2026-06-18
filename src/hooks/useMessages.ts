"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const { data } = await supabase
            .from("messages")
            .select("*, profiles(display_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (data) setMessages((prev) => [...prev, data as Message]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, content: payload.new.content } : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId]);

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

  const editMessage = useCallback(async (msgId: string, content: string) => {
    await supabase.from("messages").update({ content }).eq("id", msgId);
  }, []);

  const deleteMessage = useCallback(async (msgId: string) => {
    await supabase.from("messages").delete().eq("id", msgId);
  }, []);

  return { messages, sendMessage, editMessage, deleteMessage, loading, bottomRef };
}
