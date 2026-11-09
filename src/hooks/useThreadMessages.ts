"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mergeMessages, messageError, type MessageRecord } from "@/lib/message-state";
import { readHistoryWindow } from "@/lib/history-window";
const supabase = createClient();
const PAGE_SIZE = 100;
const SELECT_MESSAGE = "*, profiles(display_name, avatar_url, badges)";

function selectThread(kind: "channel" | "dm", id: string) {
  return kind === "channel"
    ? supabase.from("messages").select(SELECT_MESSAGE).eq("channel_id",id)
    : supabase.from("direct_messages").select(SELECT_MESSAGE).eq("conversation_id",id);
}

export function useThreadMessages(kind: "channel" | "dm", threadId: string) {
  const table = kind === "channel" ? "messages" : "direct_messages";
  const parent = kind === "channel" ? "channel_id" : "conversation_id";
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [resourceId, setResourceId] = useState(threadId);
  const [loading, setLoading] = useState(Boolean(threadId));
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentThread = useRef(threadId);
  const skipScroll = useRef(false);
  const revision = useRef(0);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const refresh = useCallback(async function refreshSnapshot(signal?: AbortSignal): Promise<void> {
    if (!threadId) return;
    const before = revision.current;
    const size = Math.max(PAGE_SIZE, messagesRef.current.length);
    try {
      const result = await readHistoryWindow<MessageRecord>(size, async (limit, cursor) => {
        let query = selectThread(kind, threadId)
          .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
        if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
        if (signal) query = query.abortSignal(signal);
        const response = await query;
        if (response.error) throw response.error;
        return (response.data ?? []) as unknown as MessageRecord[];
      });
      if (signal?.aborted || currentThread.current !== threadId) return;
      if (before !== revision.current) return refreshSnapshot(signal);
      setError(null);
      setHasMore(result.hasMore);
      // Replace the authoritative loaded window, including offline edits/deletes.
      setMessages(mergeMessages([], result.records));
    } catch (error) {
      if (signal?.aborted || currentThread.current !== threadId) return;
      setError(messageError(error));
    }
    setLoading(false);
  }, [kind, parent, table, threadId]);

  useEffect(() => {
    const controller = new AbortController();
    currentThread.current=threadId;
    messagesRef.current=[];
    // Reset the old remote resource before subscribing to the next conversation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]); setResourceId(threadId); setError(null); setHasMore(false); setLoading(Boolean(threadId)); setLoadingOlder(false);
    if (!threadId) return () => controller.abort();
    void refresh(controller.signal);
    const subscription = supabase.channel(`${kind}:${threadId}:history`, {config:{private:true}})
      .on("system", {}, (payload) => {
        if (payload.extension === "postgres_changes" && payload.status === "ok") void refresh(controller.signal);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table, filter: `${parent}=eq.${threadId}` }, async (payload) => {
        revision.current++;
        const result = await supabase.from(table).select(SELECT_MESSAGE).eq("id", payload.new.id).abortSignal(controller.signal).single();
        if (!controller.signal.aborted && currentThread.current === threadId && result.data) setMessages((previous) => mergeMessages(previous, [result.data as unknown as MessageRecord]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `${parent}=eq.${threadId}` }, (payload) => {
        revision.current++;
        if (!controller.signal.aborted && currentThread.current === threadId) setMessages((previous) => previous.map((message) => message.id === payload.new.id ? { ...message, content: payload.new.content } : message));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table, filter: `${parent}=eq.${threadId}` }, (payload) => {
        revision.current++;
        if (!controller.signal.aborted && currentThread.current === threadId) setMessages((previous) => previous.filter((message) => message.id !== payload.old.id));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh(controller.signal);
        if (!controller.signal.aborted && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) setError("Соединение прервано. Переподключаемся…");
      });
    const online = () => { void refresh(controller.signal); };
    window.addEventListener("online", online); window.addEventListener("focus", online);
    return () => {
      controller.abort(); void supabase.removeChannel(subscription);
      window.removeEventListener("online", online); window.removeEventListener("focus", online);
    };
  }, [kind, parent, refresh, table, threadId]);

  useEffect(() => {
    if (skipScroll.current) { skipScroll.current = false; return; }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadOlder = useCallback(async () => {
    const first = messagesRef.current[0];
    if (!first || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    const result = await selectThread(kind, threadId)
      .or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
    if (currentThread.current !== threadId) return;
    if (result.error) setError(messageError(result.error));
    else {
      revision.current++;
      skipScroll.current = true;
      setHasMore((result.data?.length ?? 0) > PAGE_SIZE);
      setMessages((previous) => mergeMessages(previous, (result.data ?? []).slice(0, PAGE_SIZE) as unknown as MessageRecord[]));
    }
    setLoadingOlder(false);
  }, [hasMore, loadingOlder, kind, parent, table, threadId]);

  const send = useCallback(async (content: string, senderId: string, id = crypto.randomUUID()) => {
    const text = content.trim();
    if (!threadId || !text) throw new Error("Message is empty");
    if (text.length > 16000) throw new Error("Message is too long");
    const result = await (kind === "channel"
      ? supabase.from("messages").insert({id,channel_id:threadId,sender_id:senderId,content:text})
      : supabase.from("direct_messages").insert({id,conversation_id:threadId,sender_id:senderId,content:text})).select(SELECT_MESSAGE).single();
    let record = result.data as unknown as MessageRecord | null;
    if (result.error?.code === "23505") {
      const existing = await selectThread(kind, threadId).eq("id",id).single();
      record = existing.data as unknown as MessageRecord | null;
      if (record?.sender_id !== senderId || record.content !== text) record = null;
    }
    if (!record) { if (currentThread.current === threadId) setError(messageError(result.error)); throw result.error ?? new Error("Message was not saved"); }
    revision.current++;
    if (currentThread.current === threadId) { setError(null); setMessages((previous) => mergeMessages(previous, [record!])); }
  }, [kind, parent, table, threadId]);

  const edit = useCallback(async (id: string, content: string) => {
    const result = await (kind === "channel"
      ? supabase.from("messages").update({content:content.trim()}).eq("channel_id",threadId)
      : supabase.from("direct_messages").update({content:content.trim()}).eq("conversation_id",threadId)).eq("id",id).select("id").single();
    if (currentThread.current !== threadId) { if (result.error) throw result.error; return; }
    if (result.error) { setError(messageError(result.error)); throw result.error; }
    revision.current++;
    setMessages((previous) => previous.map((message) => message.id === id ? { ...message, content: content.trim() } : message)); setError(null);
  }, [kind, parent, table, threadId]);

  const remove = useCallback(async (id: string) => {
    const result = await (kind === "channel"
      ? supabase.from("messages").delete().eq("channel_id",threadId)
      : supabase.from("direct_messages").delete().eq("conversation_id",threadId)).eq("id",id).select("id").single();
    if (currentThread.current !== threadId) return;
    if (result.error) { setError(messageError(result.error)); return; }
    revision.current++;
    setMessages((previous) => previous.filter((message) => message.id !== id)); setError(null);
  }, [kind, parent, table, threadId]);
  return { messages: resourceId === threadId ? messages : [], loading: resourceId === threadId ? loading : Boolean(threadId), error: resourceId === threadId ? error : null, hasMore: resourceId === threadId && hasMore, loadingOlder, loadOlder, refresh, send, edit, remove, bottomRef };
}
