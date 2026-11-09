"use client";

// hooks/useDMs.ts
import { useCallback, useEffect, useState } from "react";
import { useThreadMessages } from "./useThreadMessages";
export type { MessageRecord as DMMessage } from "@/lib/message-state";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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
  _myId: string,
  otherId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_or_create_dm", { p_other: otherId });
  if (error) throw error;
  return data as string | null;
}

// ─── List all DM conversations for current user ───────────────────────────────
export function useConversations(myId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!myId) { setConversations([]); return; }
    let membershipQuery = supabase.from("conversation_members").select("conversation_id").eq("user_id", myId);
    if (signal) membershipQuery = membershipQuery.abortSignal(signal);
    const memberships = await membershipQuery;
    if (signal?.aborted) return;
    if (memberships.error) { setError("Не удалось загрузить переписки. Повторите после восстановления соединения."); return; }
    if (!memberships.data?.length) { setConversations([]); setError(null); return; }
    const ids = memberships.data.map((row) => row.conversation_id);
    let query = supabase.from("conversation_members")
      .select("conversation_id, user_id, profiles(id, display_name, avatar_url, status)")
      .in("conversation_id", ids).neq("user_id", myId);
    if (signal) query = query.abortSignal(signal);
    const result = await query;
    if (signal?.aborted) return;
    if (result.error) { setError("Не удалось загрузить участников переписок."); return; }
    const list = (result.data ?? []).map((row) => {
      const profile = row.profiles as unknown as Conversation["other_user"] | null;
      return { id: row.conversation_id, other_user: { id: profile?.id ?? row.user_id,
        display_name: profile?.display_name ?? "Unknown", avatar_url: profile?.avatar_url ?? null, status: profile?.status ?? null } };
    });
    setConversations(list); setError(null);
  }, [myId]);
  useEffect(() => {
    const controller = new AbortController();
    // Do not retain the previous account's inbox when the authenticated id changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations([]); setError(null);
    void refresh(controller.signal);
    if (!myId) return () => controller.abort();
    const reload = () => { void refresh(controller.signal); };
    const subscription = supabase.channel(`user:${myId}:inbox`, {config:{private:true}})
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members", filter: `user_id=eq.${myId}` }, reload).subscribe();
    window.addEventListener("focus", reload);
    return () => { controller.abort(); void supabase.removeChannel(subscription); window.removeEventListener("focus", reload); };
  }, [myId, refresh]);
  return { conversations, setConversations, refresh, error };
}

export function useDMMessages(conversationId: string) {
  const thread = useThreadMessages("dm", conversationId);
  const send = thread.send;
  const sendDM = useCallback((content: string, senderId: string, id?: string) => send(content, senderId, id), [send]);
  return { ...thread, sendDM, editDM: thread.edit, deleteDM: thread.remove };
}
