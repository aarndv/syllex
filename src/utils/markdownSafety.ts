/** Only explicit web/mail links and in-document anchors are clickable. */
export function safeMarkdownLink(href: string | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
