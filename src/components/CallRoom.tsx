"use client";

// components/CallRoom.tsx

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useLocalParticipant,
  useTracks,
  AudioTrack,
} from "@livekit/components-react";
import { Track, Participant, RemoteParticipant } from "livekit-client";
import { useEffect, useState, useRef } from "react";
import { Mic, MicOff, MonitorUp, PhoneOff } from "lucide-react";

interface CallRoomProps {
  channelId: string;
  roomName: string;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  onLeave: () => void;
}

// ─── Participant avatar circle ────────────────────────────────────────────────
function ParticipantTile({ participant }: { participant: Participant }) {
  const isMuted = participant.isMicrophoneEnabled === false;
  const isSpeaking = participant.isSpeaking;

  // Derive initials from identity
  const identity = participant.identity ?? "?";
  const initials = identity
    .split(/[\s@_\-.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // Consistent colour from identity hash
  const colours = [
    "#5865F2", "#57F287", "#FEE75C", "#EB459E",
    "#ED4245", "#3BA55D", "#FAA61A", "#00B0F4",
  ];
  const hue = colours[
    [...identity].reduce((acc, c) => acc + c.charCodeAt(0), 0) % colours.length
  ];

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* Avatar ring – glows green when speaking */}
      <div
        style={{
          padding: 3,
          borderRadius: "50%",
          background: isSpeaking ? "#23a55a" : "transparent",
          transition: "background 0.15s ease",
          boxShadow: isSpeaking ? "0 0 0 3px rgba(35,165,90,0.35)" : "none",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: hue,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 1,
            position: "relative",
            userSelect: "none",
          }}
        >
          {initials || "?"}

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

      {/* Name label */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: isSpeaking ? "#23a55a" : "#dbdee1",
          maxWidth: 96,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
          transition: "color 0.15s ease",
        }}
      >
        {identity}
      </span>
    </div>
  );
}

// ─── Audio renderer for all remote tracks ────────────────────────────────────
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

// ─── Main voice grid ──────────────────────────────────────────────────────────
function VoiceGrid({ onLeave }: { onLeave: () => void }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const [micEnabled, setMicEnabled] = useState(true);
  const [deafened, setDeafened] = useState(false);

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(!micEnabled);
    setMicEnabled((v) => !v);
  };

  const toggleDeafen = () => setDeafened((v) => !v);

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
      {/* ── Participant grid ── */}
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

      {/* ── Control bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "16px 24px",
          background: "#232428",
          borderTop: "1px solid #111214",
        }}
      >
        <ControlButton
          onClick={toggleMic}
          active={micEnabled}
          activeColor="#5865f2"
          inactiveColor="#ed4245"
          label={micEnabled ? "Mute" : "Unmute"}
          icon={micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        />

        <ControlButton
          onClick={onLeave}
          active={false}
          activeColor="#ed4245"
          inactiveColor="#ed4245"
          label="Leave"
          icon={<PhoneOff size={18} />}
          forceActive
        />
      </div>

      <RemoteAudio />
    </div>
  );
}

// ─── Reusable control button ──────────────────────────────────────────────────
function ControlButton({
  onClick,
  active,
  activeColor,
  inactiveColor,
  label,
  icon,
  forceActive,
}: {
  onClick: () => void;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  label: string;
  icon: React.ReactNode;
  forceActive?: boolean;
}) {
  const bg = forceActive || !active ? inactiveColor : "#4e5058";

  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        background: bg,
        border: "none",
        borderRadius: 8,
        padding: "10px 20px",
        color: "#fff",
        cursor: "pointer",
        transition: "background 0.15s, transform 0.1s",
        fontSize: 12,
        fontWeight: 600,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = "none";
      }}
    >
      {icon}
      {label}
    </button>
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