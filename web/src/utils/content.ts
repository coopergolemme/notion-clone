const BLOCK_TERMINATORS = /<\/(p|div|h[1-6]|li|blockquote|pre)>/gi;
const LINE_BREAKS = /<br\s*\/?>/gi;
const TAGS = /<[^>]+>/g;

function normalizeHtml(html: string): string {
  return html
    .replace(LINE_BREAKS, "\n")
    .replace(BLOCK_TERMINATORS, "\n$&")
    .replace(TAGS, "")
    .replace(/\r\n?/g, "\n");
}

function firstMeaningfulLine(lines: string[]): string | null {
  for (const raw of lines) {
    const value = raw.trim();
    if (value.length > 0) return value;
  }
  return null;
}

export function extractTitleFromRichContent(html: string): string | null {
  if (!html) return null;
  const text = normalizeHtml(html);
  const lines = text.split("\n");
  return firstMeaningfulLine(lines);
}

export function extractTitleFromLatex(text: string): string | null {
  if (!text) return null;
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%"));
  return lines.length ? lines[0] : null;
}

export function deriveTitleFromContent(
  content: string,
  format: "rich" | "latex"
): string | null {
  return format === "latex"
    ? extractTitleFromLatex(content)
    : extractTitleFromRichContent(content);
}

export function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}
