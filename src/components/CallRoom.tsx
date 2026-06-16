"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useEffect, useState } from "react";

interface CallRoomProps {
  channelId: string;
  roomName: string;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  onLeave: () => void;
}

function NoxConference({ 
  onLeave, 
  isMinimized, 
  onMinimizeToggle 
}: { 
  onLeave: () => void; 
  isMinimized: boolean; 
  onMinimizeToggle: () => void;
}) {
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  const [showBanners, setShowBanners] = useState(true);

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-5 rounded-2xl border border-white/10 bg-[#0E0E12]/90 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide text-white/80">Voice Link ({tracks.length})</span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
          <button 
            onClick={onMinimizeToggle}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </button>
          <button 
            onClick={onLeave}
            className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500 hover:text-white transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/10 bg-[#09090B] px-6 py-6 transition-all flex flex-col gap-6 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Active Spatial Voice Mesh</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBanners(!showBanners)}
            className={`rounded-xl border border-white/5 px-3 py-1.5 text-xs font-medium transition-colors ${
              showBanners ? "bg-white/10 text-white" : "bg-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {showBanners ? "Profile Cards" : "Classic Icons"}
          </button>
          <button
            onClick={onMinimizeToggle}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="14" y1="10" x2="21" y2="3"></line>
              <line x1="10" y1="14" x2="3" y2="21"></line>
            </svg>
          </button>
          <button
            onClick={onLeave}
            className="flex h-8 px-4 items-center justify-center rounded-xl bg-red-500/10 text-xs font-medium text-red-400 hover:bg-red-500 hover:text-white transition-all"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tracks.map((trackRef) => {
          const participant = trackRef.participant;
          const isSpeaking = participant.isSpeaking;
          const isMicrophoneMuted = trackRef.publication?.isMuted ?? false;
          const name = participant.identity || "Node Operator";
          
          const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
          const avatarUrl = metadata.avatar_url || null;
          const bannerUrl = metadata.banner_url || null; 

          return (
            <div
              key={participant.sid}
              className="relative aspect-square overflow-hidden rounded-2xl border border-white/5 bg-[#0C0C0E] flex flex-col items-center justify-center group shadow-2xl"
            >
              {showBanners && (
                <div className="absolute inset-0 z-0 h-full w-full select-none pointer-events-none">
                  {bannerUrl ? (
                    <img 
                      src={bannerUrl} 
                      alt="" 
                      className="h-full w-full object-cover opacity-20 blur-[6px] scale-105 transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-b from-white/[0.02] to-transparent" />
                  )}
                </div>
              )}

              <div className="relative z-10 flex flex-col items-center gap-3">
                <div 
                  className={`h-16 w-16 rounded-full bg-[#121215] border flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-300 ${
                    isSpeaking 
                      ? "border-emerald-500 scale-105 ring-4 ring-emerald-500/10" 
                      : "border-white/10"
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-white/30">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                
                <span className="text-[11px] font-medium text-white/70 max-w-[110px] truncate bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5">
                  {name}
                </span>
              </div>

              <div className="absolute bottom-2 right-2 z-10">
                {isMicrophoneMuted ? (
                  <div className="rounded-md bg-red-500/10 p-1 text-red-400 border border-red-500/20">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                    </svg>
                  </div>
                ) : (
                  isSpeaking && (
                    <div className="rounded-md bg-emerald-500/10 p-1 text-emerald-400 border border-emerald-500/20 animate-pulse">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      </svg>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CallRoom({ roomName, isMinimized, onMinimizeToggle, onLeave }: CallRoomProps) {
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
      <div className="flex h-[100px] items-center justify-center text-xs text-red-400 bg-[#09090B] border-b border-white/10 font-mono">
        [SIGNAL_ERROR]: {error}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-[100px] items-center justify-center text-xs text-white/20 bg-[#09090B] border-b border-white/10 font-mono animate-pulse">
        [SYS]: ESTABLISHING WEBRTC AUDIO LAYER STREAM...
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      onDisconnected={onLeave}
      style={{ display: isMinimized ? "contents" : "block" }}
    >
      <NoxConference 
        onLeave={onLeave} 
        isMinimized={isMinimized} 
        onMinimizeToggle={onMinimizeToggle} 
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}