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

  // UI icons
  "💬": ["Speech Balloon", "speech_balloon"],
  "👋": ["Waving Hand", "waving_hand"],
  "📎": ["Paperclip", "paperclip"],
  "📁": ["File Folder", "file_folder"],
  "🔔": ["Bell", "bell"],
  "⚙️": ["Gear", "gear"],
  "🔗": ["Link", "link"],
};

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
