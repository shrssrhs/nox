// ─── app/api/livekit-token/route.ts ───────────────────────────────────────────
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { withDeadline } from "@/lib/request-budget";

export async function POST(req: Request) {
  const supabase = await createClient();
  let auth;
  try { auth = await withDeadline(supabase.auth.getUser()); }
  catch { return NextResponse.json({ error: "Сервис звонков временно недоступен" }, { status:503 }); }
  const { data: { user } } = auth;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.is_anonymous) return NextResponse.json({error:"Войдите в постоянный аккаунт"},{status:403});
  const {data: assurance, error: assuranceError} = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) return NextResponse.json({error:"Не удалось проверить вход"},{status:503});
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") return NextResponse.json({error:"Подтвердите вход кодом 2FA"},{status:403});

  let body: { channelId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error:"Invalid request" }, { status:400 }); }
  const channelId = body.channelId;
  if (typeof channelId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId)) return NextResponse.json({ error:"Invalid channel" }, { status:400 });
  // RLS includes membership, anonymous-user and MFA requirements. Never issue a
  // room token based only on the fact that a Supabase user exists.
  const membership = await supabase.from("channel_members").select("channel_id").eq("channel_id",channelId).eq("user_id",user.id).maybeSingle();
  if (membership.error) return NextResponse.json({ error:"Не удалось проверить доступ к звонку" }, { status:503 });
  if (!membership.data) return NextResponse.json({ error:"Нет доступа к этому звонку" }, { status:403 });
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) return NextResponse.json({ error:"Звонки временно недоступны" }, { status:503 });
  const roomName = `nox-${channelId}`;

  // Fetch avatar_url and display_name from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.display_name ??
    user.user_metadata?.full_name ??
    user.email ??
    user.id;

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: user.id,
      name: displayName,
      ttl: "1h",
      // Pass avatar URL in metadata so clients can render real avatars
      metadata: JSON.stringify({
        avatar_url: profile?.avatar_url ?? null,
        display_name: displayName,
      }),
    }
  );

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await at.toJwt() });
}
