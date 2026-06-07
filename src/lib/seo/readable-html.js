/**
 * @param {string} text
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Minimal HTML wrapper with explicit light/dark contrast for browser previews.
 *
 * @param {string} title
 * @param {string} body
 */
export function formatReadableHtml(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 2rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9375rem;
      line-height: 1.6;
    }
    @media (prefers-color-scheme: light) {
      body { background: #ffffff; color: #171717; }
    }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0a0a; color: #ededed; }
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body><pre>${escapeHtml(body)}</pre></body>
</html>`;
}
