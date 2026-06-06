import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { after } from "next/server";

import { mcpAuthStorage, touchMcpConnectionLastUsed, validateMcpToken } from "@/lib/cms/auth";
import { registerMcpTools } from "@/lib/mcp/server";
import { getMcpResourceUrl } from "@/lib/oauth/config";

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
  async (_request, bearerToken) => validateMcpToken(bearerToken),
  {
    required: true,
    resourceUrl: getMcpResourceUrl(),
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  },
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
