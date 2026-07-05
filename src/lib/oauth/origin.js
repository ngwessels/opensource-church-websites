const INVALID_OAUTH_HOSTS = new Set(["0.0.0.0", "[::]", "::", ""]);

function normalizeOAuthOrigin(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (INVALID_OAUTH_HOSTS.has(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getOAuthIssuer() {
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    const origin = normalizeOAuthOrigin(raw);
    if (origin) return origin;
  }
  return "http://localhost:3000";
}

/** Server-side OAuth redirects must not use request.url — hosted runtimes often report 0.0.0.0. */
export function oauthAbsoluteUrl(pathname, request) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const configured = getOAuthIssuer();
  if (configured !== "http://localhost:3000") {
    return new URL(path, configured).toString();
  }

  const forwardedHost = request?.headers?.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = request?.headers?.get("host")?.split(",")[0]?.trim();
  const host = forwardedHost || hostHeader;
  const hostname = host?.split(":")[0];
  if (hostname && !INVALID_OAUTH_HOSTS.has(hostname) && hostname !== "localhost") {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return new URL(path, `${proto}://${host}`).toString();
  }

  return new URL(path, configured).toString();
}
