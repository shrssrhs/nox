import React from "react";

// Renders a subset of Markdown safely without dangerouslySetInnerHTML.
// Supports: **bold**, _italic_, `code`, and bare https:// URLs.
export function renderMarkdown(text: string): React.ReactNode {
  // Tokenize by patterns in order of priority
  const re = /(\*\*[^*\n]+\*\*|_[^_\n]+_|`[^`\n]+`|https?:\/\/[^\s<>"]+)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const m = match[0];
    if (m.startsWith("**") && m.endsWith("**")) {
      nodes.push(<strong key={key++} className="font-semibold">{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("_") && m.endsWith("_")) {
      nodes.push(<em key={key++} className="italic opacity-90">{m.slice(1, -1)}</em>);
    } else if (m.startsWith("`") && m.endsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.8em] text-white/90">
          {m.slice(1, -1)}
        </code>
      );
    } else if (m.startsWith("http")) {
      const display = m.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 50);
      nodes.push(
        <a
          key={key++}
          href={m}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
        >
          {display}
        </a>
      );
    }
    last = match.index + m.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 && typeof nodes[0] === "string" ? nodes[0] : <>{nodes}</>;
}
