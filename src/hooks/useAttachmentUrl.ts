"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { attachmentPath } from "@/lib/attachment-path";
const supabase = createClient();

export function useAttachmentUrl(source: string) {
  const path = attachmentPath(source, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const [resolved, setResolved] = useState<{ source: string; url: string | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    const sign = async () => {
      const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 300);
      if (active) setResolved({ source, url: data?.signedUrl ?? null, error: error ? "Вложение недоступно. Проверьте соединение и доступ к разговору." : null });
    };
    void sign();
    const timer = setInterval(() => { void sign(); }, 240000);
    return () => { active = false; clearInterval(timer); };
  }, [path, source]);
  if (!path) return { url: source, error: null };
  return resolved?.source === source ? resolved : { url: null, error: null };
}
