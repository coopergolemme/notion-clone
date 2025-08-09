import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

export function diffPrettyHtml(a: string, b: string) {
  const diffs = dmp.diff_main(a || "", b || "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs
    .map(([op, text]) => {
      const esc = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      if (op === 0) return `<span>${esc}</span>`;
      if (op === -1) return `<span style="background:#ffe8e8">${esc}</span>`;
      return `<span style="background:#e6ffed">${esc}</span>`;
    })
    .join("");
}
