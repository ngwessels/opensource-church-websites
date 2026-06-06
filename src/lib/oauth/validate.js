import "server-only";

import { MCP_OAUTH_SCOPES } from "@/lib/firestore/paths";
import { clientAllowsRedirectUri, getOAuthClient } from "@/lib/oauth/clients";
import { getMcpResourceUrl } from "@/lib/oauth/config";
import { isValidCodeChallengeMethod } from "@/lib/oauth/pkce";

export async function validateAuthorizeRequest(params) {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const responseType = params.get("response_type");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method") || "S256";
  const state = params.get("state");
  const scopeParam = params.get("scope") || MCP_OAUTH_SCOPES.join(" ");
  const resource = params.get("resource");

  if (!clientId) throw new Error("client_id is required");
  if (!redirectUri) throw new Error("redirect_uri is required");
  if (responseType !== "code") throw new Error("response_type must be code");
  if (!codeChallenge) throw new Error("code_challenge is required");
  if (!isValidCodeChallengeMethod(codeChallengeMethod)) {
    throw new Error("code_challenge_method must be S256");
  }
  if (!state) throw new Error("state is required");

  const client = await getOAuthClient(clientId);
  if (!client) throw new Error("invalid client_id");
  if (!clientAllowsRedirectUri(client, redirectUri)) {
    throw new Error("redirect_uri mismatch");
  }

  const scopes = scopeParam
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const scope of scopes) {
    if (!MCP_OAUTH_SCOPES.includes(scope)) {
      throw new Error(`unsupported scope: ${scope}`);
    }
  }

  const expectedResource = getMcpResourceUrl();
  if (resource && resource !== expectedResource) {
    throw new Error("resource mismatch");
  }

  return {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    state,
    scopes: scopes.length ? scopes : [...MCP_OAUTH_SCOPES],
    clientName: client.clientName,
  };
}

export function buildOAuthRedirectUrl(redirectUri, params) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}
