import { createClient } from "@/lib/supabase/client";
const uploaded = new WeakMap<File, Map<string, Promise<{ url: string; messageId: string }>>>();

export async function uploadAttachment(file: File, kind: "channel" | "dm", threadId: string, userId: string) {
  if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds 25 MB");
  const key = `${kind}:${threadId}:${userId}`;
  let entries = uploaded.get(file);
  if (!entries) { entries = new Map(); uploaded.set(file, entries); }
  const cached = entries.get(key);
  if (cached) return cached;
  const operation = (async () => {
    const supabase = createClient();
    const filename = file.name.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(-120) || "file.bin";
    const prefix = kind === "dm" ? `dm-${threadId}` : threadId;
    const path = `${prefix}/${userId}/${crypto.randomUUID()}-${filename}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
    if (error) throw error;
    // This is a stable object reference, not a downloadable public link. The
    // private bucket is rendered through short-lived signed URLs by the reader.
    return { url: supabase.storage.from("attachments").getPublicUrl(path).data.publicUrl, messageId: crypto.randomUUID() };
  })();
  entries.set(key, operation);
  try { return await operation; } catch (error) { entries.delete(key); throw error; }
}
