/** Accept only this project's Storage URLs; never sign arbitrary external URLs. */
export function attachmentPath(value: string, projectUrl: string | undefined): string | null {
  if (!projectUrl || value.includes("\\") || /\/(?:\.|%2e){1,2}(?=\/|[?#]|$)/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.origin !== new URL(projectUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/attachments\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    if (path.split("/").some((part) => !part || part === "." || part === "..") || path.includes("\\")) return null;
    return path;
  } catch { return null; }
}
