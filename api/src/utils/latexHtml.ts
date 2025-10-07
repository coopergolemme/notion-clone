import katex from "katex";

function renderMathBlocks(src: string): string {
  // Render $$...$$ block math and $...$ inline math
  // Simple pass: replace $$...$$ first, then $...$
  // Note: This is a simplified parser; good enough for MVP
  let html = src;

  // Block math: $$...$$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      return `<div class="math-block">${katex.renderToString(expr.trim(), {
        displayMode: true,
        throwOnError: false,
      })}</div>`;
    } catch {
      return `<pre class="math-error">$${expr}$$</pre>`;
    }
  });

  // Inline math: $...$
  html = html.replace(/(^|[^$])\$([^\n$]+?)\$/g, (m, pre, expr) => {
    try {
      return `${pre}<span class="math-inline">${katex.renderToString(
        expr.trim(),
        { displayMode: false, throwOnError: false }
      )}</span>`;
    } catch {
      return `${pre}<code>$${expr}$</code>`;
    }
  });

  return html;
}

export function latexToHtmlPage(title: string, bodySrc: string): string {
  const bodyHtml = renderMathBlocks(bodySrc);
  // basic styling for PDF and preview
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title ? title.replace(/</g, "&lt;") : "Document"}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, 'Helvetica Neue', Arial; line-height: 1.5; padding: 24px; max-width: 800px; margin: 0 auto; }
    h1,h2,h3 { margin: 1.4em 0 0.6em; }
    .math-block { margin: 1em 0; }
    pre, code { background: #f6f8fa; padding: 2px 4px; border-radius: 4px; }
    .katex-display { overflow-x: auto; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  </style>
</head>
<body>
  <h1>${title ? title.replace(/</g, "&lt;") : ""}</h1>
  <hr/>
  <div>${bodyHtml}</div>
</body>
</html>`;
}
