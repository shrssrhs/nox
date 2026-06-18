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
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CallRoomProps {
  channelId: string;
  roomName: string;
  isMinimized: boolean;
  isFloating?: boolean;
  onMinimizeToggle: () => void;
  onLeave: () => void;
}

interface ParticipantInfo {
  avatar_url: string | null;
  banner_url: string | null;
  display_name: string;
}

// ─── Shared participant info hook ─────────────────────────────────────────────
function useParticipantInfo(
  participant: TrackReferenceOrPlaceholder["participant"]
): ParticipantInfo {
  const [info, setInfo] = useState<ParticipantInfo>({
    avatar_url: null,
    banner_url: null,
    display_name: participant.name ?? participant.identity,
  });

  useEffect(() => {
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

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        participant.identity
      );
    if (isUUID) {
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
    }
  }, [participant.identity, participant.metadata]);

  return info;
}

// ─── Screen share tile (with fullscreen button) ───────────────────────────────
function ScreenShareTile({
  trackRef,
}: {
  trackRef: TrackReferenceOrPlaceholder;
}) {
  const { participant } = trackRef;
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const info = useParticipantInfo(participant);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (isFullscreen) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  };

  const nameTag: React.CSSProperties = {
    position: "absolute",
    bottom: "10px",
    left: "10px",
    zIndex: 4,
    fontSize: "12px",
    fontWeight: "600",
    color: "#fff",
    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: "2px 8px",
    borderRadius: "4px",
  };

  if (!hasVideo) {
    return (
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
          Screen share paused
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <VideoTrack
        trackRef={trackRef as TrackReference}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <span style={nameTag}>{info.display_name}&apos;s screen</span>

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 4,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "6px",
          padding: "5px",
          cursor: "pointer",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
        }}
      >
        {isFullscreen ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Camera tile ──────────────────────────────────────────────────────────────
function AvatarTile({
  trackRef,
  compact = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  compact?: boolean;
}) {
  const { participant } = trackRef;
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const info = useParticipantInfo(participant);

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
    borderRadius: compact ? "8px" : "12px",
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  };

  const nameTag: React.CSSProperties = {
    position: "absolute",
    bottom: compact ? "4px" : "10px",
    left: compact ? "4px" : "10px",
    zIndex: 4,
    fontSize: compact ? "10px" : "12px",
    fontWeight: "600",
    color: "#fff",
    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: compact ? "1px 5px" : "2px 8px",
    borderRadius: "4px",
  };

  if (hasVideo) {
    return (
      <div style={wrapperStyle}>
        <VideoTrack
          trackRef={trackRef as TrackReference}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <span style={nameTag}>{info.display_name}</span>
      </div>
    );
  }

  const avatarSize = compact ? "36px" : "72px";
  const fontSize = compact ? "16px" : "28px";

  return (
    <div style={wrapperStyle}>
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      />
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
              width: avatarSize,
              height: avatarSize,
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid rgba(255,255,255,0.25)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          />
        ) : (
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: "50%",
              backgroundColor: "#5865F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize,
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
      <span style={nameTag}>{info.display_name}</span>
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────
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

// ─── Layout ───────────────────────────────────────────────────────────────────
function CallLayout({
  onLeave,
  isFloating = false,
}: {
  onLeave: () => void;
  isFloating?: boolean;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTracks = tracks.filter(
    (t) => t.source === Track.Source.ScreenShare
  );
  const cameraTracks = tracks.filter(
    (t) => t.source === Track.Source.Camera
  );
  const hasScreenShare = screenShareTracks.length > 0;

  // ── Compact floating view ─────────────────────────────────────────────────
  if (isFloating) {
    const displayed = cameraTracks.slice(0, 4);
    const cols = displayed.length <= 1 ? 1 : 2;
    const rows = Math.ceil(displayed.length / cols) || 1;
    return (
      <LayoutContextProvider>
        <div
          style={{
            display: "flex",
            height: "100%",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: "4px",
              padding: "4px",
              minHeight: 0,
            }}
          >
            {displayed.map((trackRef, i) => (
              <AvatarTile
                key={`${trackRef.participant.identity}-${trackRef.source}-${i}`}
                trackRef={trackRef}
                compact
              />
            ))}
          </div>
          <ControlBar
            controls={{
              microphone: true,
              camera: true,
              screenShare: false,
              chat: false,
              leave: true,
            }}
          />
        </div>
      </LayoutContextProvider>
    );
  }

  // ── Spotlight layout when screen share active ─────────────────────────────
  if (hasScreenShare) {
    return (
      <LayoutContextProvider>
        <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {/* Main screen share area */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: "8px 8px 4px 8px",
                display: "flex",
                gap: "8px",
              }}
            >
              {screenShareTracks.map((trackRef, i) => (
                <ScreenShareTile
                  key={`${trackRef.participant.identity}-screenshare-${i}`}
                  trackRef={trackRef}
                />
              ))}
            </div>

            {/* Camera strip */}
            {cameraTracks.length > 0 && (
              <div
                style={{
                  height: "100px",
                  flexShrink: 0,
                  display: "flex",
                  gap: "8px",
                  padding: "0 8px 4px 8px",
                }}
              >
                {cameraTracks.map((trackRef, i) => (
                  <AvatarTile
                    key={`${trackRef.participant.identity}-camera-${i}`}
                    trackRef={trackRef}
                    compact
                  />
                ))}
              </div>
            )}

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
          <ChatPanel />
        </div>
      </LayoutContextProvider>
    );
  }

  // ── Default grid layout ───────────────────────────────────────────────────
  const count = tracks.length || 1;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);

  return (
    <LayoutContextProvider>
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: "8px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: "8px",
                width: "100%",
                height: "100%",
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
        <ChatPanel />
      </div>
    </LayoutContextProvider>
  );
}

// ─── CallRoom ─────────────────────────────────────────────────────────────────
export function CallRoom({
  roomName,
  isFloating = false,
  onLeave,
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
      <CallLayout onLeave={onLeave} isFloating={isFloating} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ─── Audio-only variant ───────────────────────────────────────────────────────
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
