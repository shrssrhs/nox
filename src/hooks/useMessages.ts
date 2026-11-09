"use client";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useThreadMessages } from "./useThreadMessages";
export type { MessageRecord as Message } from "@/lib/message-state";
const supabase = createClient();
export function useMessages(channelId: string) {
  const thread = useThreadMessages("channel", channelId);
  const send = thread.send;
  const sendMessage = useCallback(async (content: string, id?: string) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw error ?? new Error("Sign in again");
    await send(content, data.user.id, id);
  }, [send]);
  return { ...thread, sendMessage, editMessage: thread.edit, deleteMessage: thread.remove };
}
