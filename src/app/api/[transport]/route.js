import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { after } from "next/server";

import { mcpAuthStorage, touchMcpConnectionLastUsed, validateMcpToken } from "@/lib/cms/auth";
import { registerMcpTools } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const innerHandler = createMcpHandler(
  (server) => {
    registerMcpTools(server);
  },
  {
    serverInfo: {
      name: "opensource-church-websites",
      version: "0.1.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    disableSse: true,
  },
);

const authedHandler = withMcpAuth(
  async (request) => {
    const auth = request.auth;
    const ctx = auth?.extra;

    return mcpAuthStorage.run(ctx, async () => {
      const response = await innerHandler(request);

      if (ctx?.uid && ctx?.connectionId) {
        after(async () => {
          try {
            await touchMcpConnectionLastUsed(ctx.uid, ctx.connectionId);
          } catch {
            // non-fatal
          }
        });
      }

      return response;
    });
  },
  async (request, bearerToken) => validateMcpToken(bearerToken),
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  },
);

function withMcpRequestLogging(handler) {
  return async (request) => {
    const method = request.method;
    const hasAuthHeader = Boolean(request.headers.get("authorization"));
    const response = await handler(request);
    console.info("[mcp] request complete", {
      method,
      status: response.status,
      hasAuthHeader,
      authenticated: response.status !== 401,
    });
    return response;
  };
}

const loggedHandler = withMcpRequestLogging(authedHandler);

export { loggedHandler as GET, loggedHandler as POST, loggedHandler as DELETE };
