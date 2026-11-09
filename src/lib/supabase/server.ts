import type { Database } from "./database.types";
// lib/supabase/server.ts  — use in Server Components and API Routes
import { createServerClient } from "@supabase/ssr";
import { boundedFetch } from "@/lib/request-budget";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: boundedFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // В API-роутах setAll может выбрасывать ошибку, если
            // заголовки уже отправлены. Это нормально, просто игнорируем.
          }
        },
      },
    }
  );
}