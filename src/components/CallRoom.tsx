"use client";

// components/CallRoom.tsx
// Usage: <CallRoom channelId="..." roomName="design-team-room" onLeave={() => {}} />

import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useEffect, useState } from "react";

interface CallRoomProps {
  channelId: string;
  roomName: string;
  isMinimized: boolean;        // ← добавить
  onMinimizeToggle: () => void; // ← добавить (скорее всего тоже отсутствует)
  onLeave: () => void;
}

export function CallRoom({ roomName, onLeave }: CallRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getToken() {
      try {
        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setToken(data.token);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to get token");
      }
    }
    getToken();
  }, [roomName]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        Connecting…
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      onDisconnected={onLeave}
      data-lk-theme="default"
      style={{ height: "100%" }}
    >
      {/* Full-featured UI: grid, controls, screen share, chat */}
      <VideoConference />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ─── Minimal audio-only variant (no video grid) ───────────────────────────────
export function AudioCall({ roomName, onLeave }: Omit<CallRoomProps, "channelId">) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/livekit-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName }),
    })
      .then((r) => r.json())
      .then((d) => setToken(d.token));
  }, [roomName]);

  if (!token) return null;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      onDisconnected={onLeave}
    >
      <RoomAudioRenderer />
      <ControlBar
        controls={{ microphone: true, screenShare: true, leave: true, camera: false }}
      />
    </LiveKitRoom>
  );
}