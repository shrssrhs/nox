"use client";

// Fluent Emoji renderer — uses Microsoft's open-source fluentui-emoji repo via CDN.
// Fallbacks to native Unicode if emoji not in the map.

const BASE = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";

// [folder name in repo, base file name]
const MAP: Record<string, [string, string]> = {
  // Status circles
  "🟢": ["Green Circle", "green_circle"],
  "🔴": ["Red Circle", "red_circle"],
  "🟡": ["Yellow Circle", "yellow_circle"],
  "🟠": ["Orange Circle", "orange_circle"],
  "🔵": ["Blue Circle", "blue_circle"],
  "⚫": ["Black Circle", "black_circle"],
  "⚪": ["White Circle", "white_circle"],

  // Common status moods
  "🌙": ["Crescent Moon", "crescent_moon"],
  "😴": ["Sleeping Face", "sleeping_face"],
  "🔕": ["Bell with Slash", "bell_with_slash"],
  "🎯": ["Direct Hit", "direct_hit"],
  "🏖️": ["Beach with Umbrella", "beach_with_umbrella"],
  "🤫": ["Shushing Face", "shushing_face"],
  "💪": ["Flexed Biceps", "flexed_biceps"],
  "🎮": ["Video Game", "video_game"],
  "☕": ["Hot Beverage", "hot_beverage"],
  "🍕": ["Pizza", "pizza"],
  "🚀": ["Rocket", "rocket"],
  "💤": ["Zzz", "zzz"],
  "📵": ["No Mobile Phones", "no_mobile_phones"],
  "🤒": ["Face with Thermometer", "face_with_thermometer"],
  "👻": ["Ghost", "ghost"],

  // Reactions
  "👍": ["Thumbs Up", "thumbs_up"],
  "❤️": ["Red Heart", "red_heart"],
  "😂": ["Face with Tears of Joy", "face_with_tears_of_joy"],
  "🔥": ["Fire", "fire"],
  "😮": ["Face with Open Mouth", "face_with_open_mouth"],
  "💯": ["Hundred Points", "hundred_points"],
  "🎉": ["Party Popper", "party_popper"],
  "👀": ["Eyes", "eyes"],
  "😍": ["Smiling Face with Heart-Eyes", "smiling_face_with_heart-eyes"],
  "🤣": ["Rolling on the Floor Laughing", "rolling_on_the_floor_laughing"],
  "😭": ["Loudly Crying Face", "loudly_crying_face"],
  "🤯": ["Exploding Head", "exploding_head"],

  // UI icons
  "💬": ["Speech Balloon", "speech_balloon"],
  "👋": ["Waving Hand", "waving_hand"],
  "📎": ["Paperclip", "paperclip"],
  "📁": ["File Folder", "file_folder"],
  "🔔": ["Bell", "bell"],
  "⚙️": ["Gear", "gear"],
  "🔗": ["Link", "link"],
};

// CSS dot for small status indicators on avatars (10-14px range)
const STATUS_DOT_COLORS: Record<string, string> = {
  "🟢": "#22c55e",
  "🔴": "#ef4444",
  "🟡": "#eab308",
  "🟠": "#f97316",
  "🔵": "#3b82f6",
  "⚫": "#6b7280",
  "⚪": "#9ca3af",
  "🌙": "#8b5cf6",
  "😴": "#8b5cf6",
  "👻": "#6b7280",
  "📵": "#6b7280",
  "🔕": "#8b5cf6",
  "🤒": "#f97316",
  "🏖️": "#f59e0b",
  "🎯": "#3b82f6",
  "💪": "#22c55e",
  "🚀": "#3b82f6",
  "🎮": "#8b5cf6",
  "☕": "#f59e0b",
  "🍕": "#f97316",
  "🤫": "#6b7280",
};

export function StatusDot({ status, size = 10 }: { status: string | null | undefined; size?: number }) {
  const emoji = statusEmoji(status);
  const color = STATUS_DOT_COLORS[emoji] ?? "#22c55e";
  return (
    <span
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
        border: "1.5px solid rgba(0,0,0,0.4)",
      }}
    />
  );
}

interface FEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
}

export function FEmoji({ emoji, size = 16, className = "" }: FEmojiProps) {
  const entry = MAP[emoji];
  if (!entry) return <span className={className} style={{ fontSize: size * 0.85, lineHeight: 1 }}>{emoji}</span>;

  const [folder, file] = entry;
  const src = `${BASE}/${encodeURIComponent(folder)}/Color/${file}_color.svg`;

  return (
    <img
      src={src}
      alt={emoji}
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
      onError={(e) => {
        const el = e.currentTarget;
        const span = document.createElement("span");
        span.textContent = emoji;
        span.style.fontSize = `${Math.round(size * 0.85)}px`;
        span.style.lineHeight = "1";
        el.replaceWith(span);
      }}
    />
  );
}

// Extracts the first emoji character from a status string like "🟢 Online"
export function statusEmoji(status: string | null | undefined): string {
  if (!status) return "🟢";
  // grab first grapheme cluster (handles multi-codepoint emoji)
  const match = status.match(/^(\p{Emoji_Presentation}|\p{Emoji}️)/u);
  return match?.[0] ?? "🟢";
}
