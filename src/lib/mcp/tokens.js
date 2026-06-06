export function slugifyConfigKey(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `parish-site-${slug || "connection"}`;
}

export function buildCursorMcpOAuthConfig({ configKey = "parish-site", appUrl }) {
  const baseUrl = appUrl.replace(/\/$/, "");
  return {
    mcpServers: {
      [configKey]: {
        url: `${baseUrl}/api/mcp`,
      },
    },
  };
}
