/**
 * Ask the server to purge cached public pages after a builder publish/save.
 * Requires a signed-in admin (Firebase ID token).
 */
export async function requestPublicRevalidate({ getIdToken, scope = "page", slug } = {}) {
  if (!getIdToken) return;

  try {
    const token = await getIdToken();
    await fetch("/api/revalidate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope, slug }),
    });
  } catch {
    // Cache will refresh on the next deploy or manual revalidation.
  }
}
