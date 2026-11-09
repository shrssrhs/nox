export interface MessageRecord {
  id: string;
  content: string;
  created_at: string;
  sender_id: string | null;
  profiles: { display_name: string | null; avatar_url: string | null; badges?: string[] | null } | null;
}

export function mergeMessages<T extends MessageRecord>(previous: T[], incoming: T[]): T[] {
  const byId = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** Reuse the identity of an uncertain send on retry. Edited content is new. */
export function submissionId(previous: { content: string; id: string; scope?: string } | null, content: string, scope = "") {
  return previous?.content === content && (previous.scope ?? "") === scope ? previous : { content, scope, id: crypto.randomUUID() };
}

export function messageError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "42501") return "Нет доступа. Проверьте вход и участие в разговоре.";
  if (error instanceof Error && error.message === "Message is too long") return "Сообщение длиннее 16 000 символов.";
  return "Не удалось выполнить действие. Проверьте соединение и повторите — текст сохранён.";
}
