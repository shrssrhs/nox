"use client";

// components/CallRoom.tsx
// Usage: <CallRoom channelId="..." roomName="design-team-room" onLeave={() => {}} />

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
} from "@livekit/components-react";
import { Track, Participant } from "livekit-client";
import { useEffect, useState } from "react";

interface CallRoomProps {
  channelId: string;
  roomName: string;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  onLeave: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParticipantInfo {
  avatar_url: string | null;
  banner_url: string | null;
  display_name: string;
}

// ─── Single participant tile with avatar + banner ─────────────────────────────
function AvatarTile({ participant }: { participant: Participant }) {
  const [info, setInfo] = useState<ParticipantInfo>({
    avatar_url: null,
    banner_url: null,
    display_name: participant.name ?? participant.identity,
  });

  useEffect(() => {
    // 1. Сначала берём данные из metadata токена (без лишнего запроса)
    try {
      const meta = participant.metadata
        ? JSON.parse(participant.metadata)
        : {};
      if (meta.avatar_url || meta.display_name) {
        setInfo((prev) => ({
          ...prev,
          avatar_url: meta.avatar_url ?? prev.avatar_url,
          display_name: meta.display_name ?? prev.display_name,
        }));
      }
    } catch {}

    // 2. Дополнительно тянем banner_url через API (identity = UUID)
    fetch(`/api/profile?id=${participant.identity}`)
      .then((r) => r.json())
      .then((profile) => {
        if (profile && !profile.error) {
          setInfo({
            avatar_url: profile.avatar_url ?? null,
            banner_url: profile.banner_url ?? null,
            display_name:
              profile.display_name ??
              participant.name ??
              participant.identity,
          });
        }
      })
      .catch(() => {});
  }, [participant.identity, participant.metadata]);

  // Проверяем, включена ли камера у участника
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  ).filter((t) => t.participant.identity === participant.identity);

  const isCameraOn =
    cameraTracks.length > 0 &&
    cameraTracks[0].publication?.isMuted === false;

  // Если камера включена — просто рендерим стандартный видео-тайл
  if (isCameraOn) {
    return (
      <div style={styles.tileWrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <video
          ref={(el) => {
            if (el && cameraTracks[0]?.publication?.track) {
              cameraTracks[0].publication.track.attach(el);
            }
          }}
          autoPlay
          playsInline
          muted={participant.isLocal}
          style={styles.video}
        />
        <span style={styles.nameTag}>{info.display_name}</span>
      </div>
    );
  }

  // Камера выключена — показываем баннер + аватар
  return (
    <div style={styles.tileWrapper}>
      {/* Баннер как фон */}
      {info.banner_url ? (
        <div
          style={{
            ...styles.banner,
            backgroundImage: `url(${info.banner_url})`,
          }}
        />
      ) : (
        <div style={styles.bannerFallback} />
      )}

      {/* Затемняющий оверлей поверх баннера */}
      <div style={styles.overlay} />

      {/* Аватар по центру */}
      <div style={styles.avatarWrapper}>
        {info.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.avatar_url}
            alt={info.display_name}
            style={styles.avatar}
          />
        ) : (
          <div style={styles.avatarFallback}>
            {info.display_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Имя участника */}
      <span style={styles.nameTag}>{info.display_name}</span>
    </div>
  );
}

// ─── Кастомная сетка участников ───────────────────────────────────────────────
function ParticipantGrid() {
  const participants = useParticipants();

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns:
      participants.length === 1
        ? "1fr"
        : participants.length <= 4
        ? "repeat(2, 1fr)"
        : "repeat(3, 1fr)",
    gap: "8px",
    width: "100%",
    height: "100%",
    padding: "8px",
    boxSizing: "border-box",
  };

  return (
    <div style={gridStyle}>
      {participants.map((p) => (
        <AvatarTile key={p.identity} participant={p} />
      ))}
    </div>
  );
}

// ─── CallRoom (основной компонент) ────────────────────────────────────────────
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
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Кастомная сетка с аватарами вместо VideoConference */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ParticipantGrid />
      </div>

      {/* Панель управления — не трогаем */}
      <ControlBar
        controls={{
          microphone: true,
          screenShare: true,
          leave: true,
          camera: true,
        }}
      />

      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ─── Minimal audio-only variant (не трогаем) ──────────────────────────────────
export function AudioCall({
  roomName,
  onLeave,
}: Omit<CallRoomProps, "channelId">) {
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

// ─── Стили ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  tileWrapper: {
    position: "relative",
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "160px",
    width: "100%",
    height: "100%",
  },
  banner: {
    position: "absolute",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "blur(2px) brightness(0.6)",
    transform: "scale(1.05)", // убирает белые края от blur
  },
  bannerFallback: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg, #2a2a3a 0%, #1a1a2e 100%)",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  avatarWrapper: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  avatar: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid rgba(255,255,255,0.25)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
  },
  avatarFallback: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: "#5865F2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: "700",
    color: "#fff",
    border: "3px solid rgba(255,255,255,0.25)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
  },
  nameTag: {
    position: "absolute",
    bottom: "10px",
    left: "10px",
    zIndex: 3,
    fontSize: "12px",
    fontWeight: "600",
    color: "#fff",
    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
};