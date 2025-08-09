// Parse [[Page Title]] references and normalize titles
export function extractWikiLinks(text: string): string[] {
  if (!text) return [];
  const re = /\[\[([^\]]+)\]\]/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

export function normTitle(s: string): string {
  return s.trim().toLowerCase();
}
