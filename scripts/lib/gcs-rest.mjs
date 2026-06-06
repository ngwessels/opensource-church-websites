import { createSign, randomUUID } from "node:crypto";

async function fetchAccessToken({ clientEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/devstorage.read_write",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  sign.end();
  const assertion = `${header}.${payload}.${sign.sign(privateKey, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || "Failed to obtain Cloud Storage access token");
  }
  return {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000 - 60_000,
  };
}

/**
 * Minimal GCS client via REST — avoids slow firebase-admin startup.
 * @param {{ clientEmail: string, privateKey: string, bucketName: string }} credentials
 */
export async function createGcsRest(credentials) {
  if (!credentials.bucketName) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required for --upload-images");
  }

  let { token, expiresAt } = await fetchAccessToken(credentials);

  async function ensureToken() {
    if (Date.now() < expiresAt) return token;
    ({ token, expiresAt } = await fetchAccessToken(credentials));
    return token;
  }

  function firebaseDownloadUrl(objectName, downloadToken) {
    const encodedPath = encodeURIComponent(objectName);
    return (
      `https://firebasestorage.googleapis.com/v0/b/${credentials.bucketName}/o/${encodedPath}` +
      `?alt=media&token=${downloadToken}`
    );
  }

  async function uploadPublicObject(objectName, buffer, contentType) {
    const authToken = await ensureToken();
    const downloadToken = randomUUID();
    const boundary = `upload_${randomUUID().replace(/-/g, "")}`;
    const metadataJson = JSON.stringify({
      name: objectName,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    });

    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n`,
      ),
      Buffer.from(`--${boundary}\r\nContent-Type: ${contentType || "application/octet-stream"}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const url =
      `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(credentials.bucketName)}/o` +
      "?uploadType=multipart";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.error?.message || `Cloud Storage upload failed (${res.status})`;
      throw new Error(message);
    }

    return firebaseDownloadUrl(objectName, downloadToken);
  }

  return { uploadPublicObject, bucketName: credentials.bucketName };
}
