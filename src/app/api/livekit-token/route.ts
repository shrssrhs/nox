// ─── app/api/livekit-token/route.ts ───────────────────────────────────────────
// Returns a short-lived LiveKit access token for the requesting user.
// POST { roomName: string }

import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomName } = await req.json();
  if (!roomName) {
    return NextResponse.json({ error: "roomName is required" }, { status: 400 });
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: user.id,
      name: user.user_metadata?.full_name ?? user.email ?? user.id,
      ttl: "4h",
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