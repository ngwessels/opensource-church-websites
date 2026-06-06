import { createSign } from "node:crypto";

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    const fields = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) fields[key] = toFirestoreValue(nested);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in value) {
    const obj = {};
    for (const [key, nested] of Object.entries(value.mapValue.fields || {})) {
      obj[key] = fromFirestoreValue(nested);
    }
    return obj;
  }
  return null;
}

async function fetchAccessToken({ clientEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/datastore",
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
    throw new Error(body.error_description || body.error || "Failed to obtain Firestore access token");
  }
  return {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000 - 60_000,
  };
}

/**
 * Minimal Firestore client via REST — avoids slow firebase-admin/gRPC startup.
 * @param {{ projectId: string, clientEmail: string, privateKey: string }} credentials
 */
export async function createFirestoreRest(credentials) {
  let { token, expiresAt } = await fetchAccessToken(credentials);

  async function ensureToken() {
    if (Date.now() < expiresAt) return token;
    ({ token, expiresAt } = await fetchAccessToken(credentials));
    return token;
  }

  async function request(url, options = {}) {
    const authToken = await ensureToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    if (res.status === 404) return null;

    const text = await res.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      const message =
        typeof body === "object" && body?.error?.message
          ? body.error.message
          : `Firestore REST ${res.status}`;
      throw new Error(message);
    }

    return body;
  }

  function collection(name) {
    return {
      doc(id) {
        const docPath = `projects/${credentials.projectId}/databases/(default)/documents/${name}/${id}`;

        return {
          async get() {
            const body = await request(`https://firestore.googleapis.com/v1/${docPath}`);
            if (!body) return { exists: false, data: () => undefined };

            const data = {};
            for (const [key, value] of Object.entries(body.fields || {})) {
              data[key] = fromFirestoreValue(value);
            }
            return { exists: true, data: () => data };
          },

          async update(fields) {
            const encodedFields = {};
            for (const [key, value] of Object.entries(fields)) {
              encodedFields[key] = toFirestoreValue(value);
            }

            const mask = Object.keys(fields)
              .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
              .join("&");

            await request(`https://firestore.googleapis.com/v1/${docPath}?${mask}`, {
              method: "PATCH",
              body: JSON.stringify({ fields: encodedFields }),
            });
          },
        };
      },
    };
  }

  return { collection };
}
