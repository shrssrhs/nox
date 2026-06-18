"use client";

// hooks/useDMs.ts
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface DMMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

export interface Conversation {
  id: string;
  other_user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    status: string | null;
  };
  last_message?: string;
}

// ─── Get or create a DM conversation between two users ───────────────────────
export async function getOrCreateConversation(
  myId: string,
  otherId: string
): Promise<string | null> {
  // Check if conversation already exists
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", myId);

  const { data: theirs } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", otherId);

  const myIds    = new Set((mine ?? []).map((r: any) => r.conversation_id));
  const theirIds = (theirs ?? []).map((r: any) => r.conversation_id);
  const shared   = theirIds.find((id: string) => myIds.has(id));

  if (shared) return shared;

  // Create new conversation
  const { data: conv } = await supabase
    .from("conversations")
    .insert({})
    .select("id")
    .single();

  if (!conv) return null;

  await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: myId },
    { conversation_id: conv.id, user_id: otherId },
  ]);

  return conv.id;
}

// ─── List all DM conversations for current user ───────────────────────────────
export function useConversations(myId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!myId) return;

    async function load() {
      // Get all conversation_ids for me
      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", myId);

      if (!memberships?.length) return;
      const ids = memberships.map((m: any) => m.conversation_id);

      // Get other members
      const { data: others } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id, profiles(id, display_name, avatar_url, status)")
        .in("conversation_id", ids)
        .neq("user_id", myId);

      const list: Conversation[] = (others ?? []).map((r: any) => ({
        id: r.conversation_id,
        other_user: {
          id:           r.profiles?.id ?? r.user_id,
          display_name: r.profiles?.display_name ?? "Unknown",
          avatar_url:   r.profiles?.avatar_url ?? null,
          status:       r.profiles?.status ?? null,
        },
      }));

      setConversations(list);
    }

    load();
  }, [myId]);

  return { conversations, setConversations };
}

// ─── Messages for one DM conversation ────────────────────────────────────────
export function useDMMessages(conversationId: string) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (!conversationId) return;

    async function fetchMessages() {
      const { data } = await supabase
        .from("direct_messages")
        .select("*, profiles(display_name, avatar_url)")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data as DMMessage[]) ?? []);
      setLoading(false);
    }

    fetchMessages();

    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const { data } = await supabase
            .from("direct_messages")
            .select("*, profiles(display_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (data) setMessages((prev) => [...prev, data as DMMessage]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => m.id === payload.new.id ? { ...m, content: payload.new.content } : m)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  async function sendDM(content: string, senderId: string) {
    if (!content.trim()) return;
    await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
    });
  }

  async function editDM(msgId: string, content: string) {
    await supabase.from("direct_messages").update({ content }).eq("id", msgId);
  }

  async function deleteDM(msgId: string) {
    await supabase.from("direct_messages").delete().eq("id", msgId);
  }

  return { messages, sendDM, editDM, deleteDM, loading, bottomRef };
}