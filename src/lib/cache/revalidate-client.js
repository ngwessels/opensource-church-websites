/**
 * Ask the server to purge cached public pages after a builder publish/save.
 * Requires a signed-in admin (Firebase ID token).
 */
export async function requestPublicRevalidate({ getIdToken, scope = "page", slug } = {}) {
  if (!getIdToken) return;

  try {
    const token = await getIdToken();
    if (!token) {
      console.error("Public revalidate skipped: missing ID token");
      return;
    }

    const response = await fetch("/api/revalidate", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope, slug }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Public revalidate failed", response.status, detail);
    }
  } catch (err) {
    console.error("Public revalidate failed", err);
  }
}
