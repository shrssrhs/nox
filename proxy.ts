// middleware.ts — place in project root (same level as package.json)
import { withDeadline, boundedFetch } from "./src/lib/request-budget";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: boundedFetch },
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh only existing sessions here. Page/API handlers and RLS are the
  // authority; no network round-trip is needed for a logged-out landing page.
  if (!request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"))) return supabaseResponse;
  try {
    const { error } = await withDeadline(supabase.auth.getUser(), 6000);
    if (error && (error.status === 0 || (error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError")) throw error;
  } catch {
    return new NextResponse('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nox</title><body style="background:#09090b;color:white;font:16px system-ui;display:grid;place-items:center;min-height:95vh"><main><h1>Nox временно недоступен</h1><p>Не удалось подключиться. Ваш вход сохранён.</p><button onclick="location.reload()">Повторить</button></main></body></html>', { status:503,headers:{"Content-Type":"text/html; charset=utf-8","Retry-After":"10","Cache-Control":"no-store"} });
  }

  return supabaseResponse;
}

export const config = {
  // Exclude static/public assets so auth never redirects them to /login.
  // manifest.json & sw.js must be excluded or the browser gets HTML back
  // ("Manifest: Line 1 Syntax error" / broken service-worker registration).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|obj|glb|gltf)$).*)"],
};