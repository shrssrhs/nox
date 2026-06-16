"use client";

// components/CallRoom.tsx

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  LayoutContextProvider,
  useParticipants,
  useLocalParticipant,
  useTracks,
  AudioTrack,
} from "@livekit/components-react";
import { Track, Participant } from "livekit-client";
import { useEffect, useState } from "react";
import { MicOff } from "lucide-react";

interface CallRoomProps {
  channelId: string;
  roomName: string;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  onLeave: () => void;
}

// ─── Parse participant metadata ───────────────────────────────────────────────
function useParticipantMeta(participant: Participant) {
  const raw = participant.metadata;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ─── Participant avatar circle ────────────────────────────────────────────────
function ParticipantTile({ participant }: { participant: Participant }) {
  const isMuted = !participant.isMicrophoneEnabled;
  const isSpeaking = participant.isSpeaking;
  const meta = useParticipantMeta(participant);

  const displayName: string = meta.display_name ?? participant.name ?? participant.identity ?? "?";
  const avatarUrl: string | null = meta.avatar_url ?? null;

  // Initials fallback
  const initials = displayName
    .split(/[\s@_\-.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join("") || "?";

  // Consistent colour from identity hash
  const colours = [
    "#5865F2", "#57F287", "#FEE75C", "#EB459E",
    "#ED4245", "#3BA55D", "#FAA61A", "#00B0F4",
  ];
  const identity = participant.identity ?? "";
  const hue = colours[
    [...identity].reduce((acc, c) => acc + c.charCodeAt(0), 0) % colours.length
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        userSelect: "none",
      }}
    >
      {/* Speaking ring */}
      <div
        style={{
          padding: 3,
          borderRadius: "50%",
          background: isSpeaking ? "#23a55a" : "transparent",
          boxShadow: isSpeaking ? "0 0 0 3px rgba(35,165,90,0.35)" : "none",
          transition: "background 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: hue,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            position: "relative",
            flexShrink: 0,
          }}
        >
          {/* Real avatar or initials */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}

          {/* Muted badge */}
          {isMuted && (
            <div
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#ed4245",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #1e1f22",
              }}
            >
              <MicOff size={11} color="#fff" />
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: isSpeaking ? "#23a55a" : "#dbdee1",
          maxWidth: 100,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
          transition: "color 0.15s ease",
        }}
      >
        {displayName}
      </span>
    </div>
  );
}

// ─── Audio for remote participants ────────────────────────────────────────────
function RemoteAudio() {
  const tracks = useTracks([Track.Source.Microphone]);
  return (
    <>
      {tracks
        .filter((t) => !t.participant.isLocal)
        .map((t) => (
          <AudioTrack key={t.participant.identity} trackRef={t} />
        ))}
    </>
  );
}

// ─── Voice grid with native LiveKit ControlBar ────────────────────────────────
function VoiceGrid({ onLeave }: { onLeave: () => void }) {
  const participants = useParticipants();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#1e1f22",
        fontFamily: "var(--font-sans, 'gg sans', 'Noto Sans', sans-serif)",
      }}
    >
      {/* Participant circles */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          gap: 32,
          padding: "32px 24px",
        }}
      >
        {participants.map((p) => (
          <ParticipantTile key={p.identity} participant={p} />
        ))}
      </div>

      {/* Native LiveKit ControlBar — microphone, camera, screen share, chat, leave */}
      <div
        style={{
          borderTop: "1px solid #111214",
          background: "#232428",
          // Override LK default styles so it fits our dark theme
        }}
      >
        <ControlBar
          controls={{
            microphone: true,
            camera: true,
            screenShare: true,
            chat: true,
            leave: true,
          }}
        />
      </div>

      <RemoteAudio />
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
export function CallRoom({
  roomName,
  onLeave,
  isMinimized,
  onMinimizeToggle,
}: CallRoomProps) {
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
      <VoiceGrid onLeave={onLeave} />
    </LiveKitRoom>
  );
}

// ─── Minimal audio-only variant ───────────────────────────────────────────────
export function AudioCall({
  roomName,
  onLeave,
}: Omit<CallRoomProps, "channelId" | "isMinimized" | "onMinimizeToggle">) {
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
        controls={{
          microphone: true,
          screenShare: true,
          leave: true,
          camera: false,
        }}
      />
    </LiveKitRoom>
  );
}