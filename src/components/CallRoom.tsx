"use client";

// components/CallRoom.tsx

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  Chat,
  VideoTrack,
  useTracks,
  LayoutContextProvider,
  useMaybeLayoutContext,
  isTrackReference,
} from "@livekit/components-react";
import type {
  TrackReferenceOrPlaceholder,
  TrackReference,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CallRoomProps {
  channelId: string;
  roomName: string;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  onLeave: () => void;
}

interface ParticipantInfo {
  avatar_url: string | null;
  banner_url: string | null;
  display_name: string;
}

// ─── Name tag стиль ───────────────────────────────────────────────────────────
const nameTagStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "10px",
  left: "10px",
  fontSize: "12px",
  fontWeight: "600",
  color: "#fff",
  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
  backgroundColor: "rgba(0,0,0,0.4)",
  padding: "2px 8px",
  borderRadius: "4px",
  zIndex: 4,
};

// ─── Chat panel (управляется LiveKit LayoutContext) ───────────────────────────
function ChatPanel() {
  const ctx = useMaybeLayoutContext();
  const isOpen = ctx?.widget?.state?.showChat ?? false;

  if (!isOpen) return null;

  return (
    <div
      style={{
        width: "320px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        backgroundColor: "var(--lk-bg2, #111827)",
        overflow: "hidden",
      }}
    >
      <Chat />
    </div>
  );
}

// ─── Один тайл: принимает trackRef напрямую, без GridLayout ──────────────────
function AvatarTile({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const { participant } = trackRef;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  // isTrackReference = publication существует (камера опубликована)
  const hasVideo =
    isTrackReference(trackRef) && !trackRef.publication.isMuted;

  const [info, setInfo] = useState<ParticipantInfo>({
    avatar_url: null,
    banner_url: null,
    display_name: participant.name ?? participant.identity,
  });

  useEffect(() => {
    // 1. Берём из metadata токена (мгновенно, без запроса)
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

    // 2. Тянем banner_url из /api/profile
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

  // ── Демонстрация экрана (16:9, без квадрата) ──────────────────────────────
  if (isScreenShare && hasVideo) {
    return (
      <div
        style={{
          borderRadius: "12px",
          overflow: "hidden",
          aspectRatio: "16/9",
          position: "relative",
          backgroundColor: "#000",
        }}
      >
        <VideoTrack
          trackRef={trackRef as TrackReference}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        <span style={nameTagStyle}>{info.display_name}</span>
      </div>
    );
  }

  // ── Камера ВКЛЮЧЕНА → квадратный видео-тайл ───────────────────────────────
  if (hasVideo) {
    return (
      <div
        style={{
          borderRadius: "12px",
          overflow: "hidden",
          aspectRatio: "1 / 1",
          position: "relative",
          backgroundColor: "#000",
        }}
      >
        <VideoTrack
          trackRef={trackRef as TrackReference}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <span style={nameTagStyle}>{info.display_name}</span>
      </div>
    );
  }

  // ── Камера ВЫКЛЮЧЕНА → баннер как фон + аватар по центру (квадрат) ────────
  return (
    <div
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        aspectRatio: "1 / 1",
        position: "relative",
        backgroundColor: "#1a1a1a",
      }}
    >
      {/* Баннер-фон */}
      {info.banner_url ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${info.banner_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(2px) brightness(0.6)",
            transform: "scale(1.05)",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #2a2a3a 0%, #1a1a2e 100%)",
          }}
        />
      )}

      {/* Затемняющий оверлей */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      />

      {/* Аватар по центру */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        {info.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.avatar_url}
            alt={info.display_name}
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid rgba(255,255,255,0.25)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          />
        ) : (
          <div
            style={{
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
            }}
          >
            {info.display_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Имя участника */}
      <span style={nameTagStyle}>{info.display_name}</span>
    </div>
  );
}

// ─── Внутренний лейаут ────────────────────────────────────────────────────────
function CallLayout({ onLeave }: { onLeave: () => void }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const cols =
    tracks.length <= 1 ? 1 : tracks.length <= 4 ? 2 : 3;

  return (
    <LayoutContextProvider>
      <div
        style={{
          display: "flex",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Основная колонка */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* Сетка тайлов */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "8px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: "8px",
              }}
            >
              {tracks.map((trackRef, i) => (
                <AvatarTile
                  key={`${trackRef.participant.identity}-${trackRef.source}-${i}`}
                  trackRef={trackRef}
                />
              ))}
            </div>
          </div>

          {/* Панель управления */}
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

        {/* Чат (открывается кнопкой Chat) */}
        <ChatPanel />
      </div>
    </LayoutContextProvider>
  );
}

// ─── CallRoom (основной экспорт) ──────────────────────────────────────────────
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
      <CallLayout onLeave={onLeave} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ─── Minimal audio-only variant — не трогаем ──────────────────────────────────
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