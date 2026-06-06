export function slugifyConfigKey(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `parish-site-${slug || "connection"}`;
}

export function buildCursorMcpConfig({ configKey, appUrl, token }) {
  const baseUrl = appUrl.replace(/\/$/, "");
  return {
    mcpServers: {
      [configKey]: {
        url: `${baseUrl}/api/mcp`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  };
}
