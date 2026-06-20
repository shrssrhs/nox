"use client";

import { useEffect, useRef, useState } from "react";

// ─── Language map ─────────────────────────────────────────────────────────────
export const CODE_LANGS: Record<string, string> = {
  py: "Python", txt: "Text", json: "JSON", java: "Java",
  rs: "Rust", js: "JavaScript", jsx: "JavaScript",
  ts: "TypeScript", tsx: "TypeScript",
  cpp: "C++", cc: "C++", cxx: "C++",
  cs: "C#", c: "C", h: "C",
};

export function getFileExt(url: string): string {
  return (url.split("/").pop()?.split("?")[0] ?? "").split(".").pop()?.toLowerCase() ?? "";
}

export function getFilename(url: string): string {
  const raw = url.split("/").pop()?.split("?")[0] ?? "";
  // Supabase filenames: original-randomhash-timestamp.ext — strip the random suffix
  const ext = raw.split(".").pop() ?? "";
  const stem = raw.slice(0, raw.lastIndexOf("."));
  const parts = stem.split("-");
  // Heuristic: last 2 parts are hash + timestamp, rejoin the rest
  const name = parts.length > 2 ? parts.slice(0, -2).join("-") : parts[0];
  return name ? `${name}.${ext}` : raw;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface FilePreviewProps {
  url: string;
  onClose: () => void;
}

export function FilePreview({ url, onClose }: FilePreviewProps) {
  const ext = getFileExt(url);
  const filename = getFilename(url);
  const isImage = /^(jpeg|jpg|gif|png|webp|svg)$/.test(ext);
  const isVideo = /^(mp4|webm|ogg|mov)$/.test(ext);
  const isCode = ext in CODE_LANGS;
  const lang = CODE_LANGS[ext] ?? "File";

  const [code, setCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(isCode);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch code content
  useEffect(() => {
    if (!isCode) return;
    setLoadingCode(true);
    fetch(url)
      .then((r) => r.text())
      .then((t) => { setCode(t); setLoadingCode(false); })
      .catch(() => { setCode("// Failed to load file."); setLoadingCode(false); });
  }, [url, isCode]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Close hint */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 18,
          right: 22,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.3)",
          fontSize: 12,
          fontFamily: "monospace",
        }}
      >
        [esc]
      </button>

      {/* ── Image ── */}
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={filename}
          style={{
            maxWidth: "90vw",
            maxHeight: "90vh",
            objectFit: "contain",
            borderRadius: 8,
            boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
          }}
        />
      )}

      {/* ── Video ── */}
      {isVideo && (
        <video
          src={url}
          controls
          autoPlay
          style={{
            maxWidth: "90vw",
            maxHeight: "80vh",
            borderRadius: 8,
            boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
          }}
        />
      )}

      {/* ── Code ── */}
      {isCode && (
        <div
          style={{
            width: "min(820px, 92vw)",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            background: "var(--nox-panel)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 8px 48px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "monospace",
                }}
              >
                {filename}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.06)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontFamily: "monospace",
                }}
              >
                {lang}
              </span>
            </div>
            <button
              onClick={handleCopy}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: copied ? "rgba(52,211,153,0.8)" : "rgba(255,255,255,0.3)",
                fontSize: 11,
                fontFamily: "monospace",
                transition: "color 0.15s",
              }}
            >
              {copied ? "[copied]" : "[copy]"}
            </button>
          </div>

          {/* Code body */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {loadingCode ? (
              <p
                style={{
                  padding: 20,
                  color: "rgba(255,255,255,0.25)",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                loading…
              </p>
            ) : (
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  minWidth: "max-content",
                  padding: "12px 0",
                }}
              >
                <tbody>
                  {(code ?? "").split("\n").map((line, i) => (
                    <tr key={i} style={{ lineHeight: "1.65" }}>
                      {/* Line number */}
                      <td
                        style={{
                          padding: "0 14px",
                          textAlign: "right",
                          color: "rgba(255,255,255,0.18)",
                          fontSize: 11,
                          fontFamily: "monospace",
                          userSelect: "none",
                          minWidth: 38,
                          verticalAlign: "top",
                          borderRight: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        {i + 1}
                      </td>
                      {/* Line content */}
                      <td
                        style={{
                          padding: "0 20px 0 16px",
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: "rgba(255,255,255,0.82)",
                          whiteSpace: "pre",
                        }}
                      >
                        {line || " "}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
