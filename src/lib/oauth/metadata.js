import "server-only";

import { getOAuthIssuer, getMcpResourceUrl } from "@/lib/oauth/config";
import { MCP_OAUTH_SCOPES } from "@/lib/firestore/paths";

export function getAuthorizationServerMetadata() {
  const issuer = getOAuthIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: MCP_OAUTH_SCOPES,
  };
}

export function getProtectedResourceMetadata() {
  const issuer = getOAuthIssuer();
  return {
    resource: getMcpResourceUrl(),
    authorization_servers: [issuer],
    scopes_supported: MCP_OAUTH_SCOPES,
  };
}
