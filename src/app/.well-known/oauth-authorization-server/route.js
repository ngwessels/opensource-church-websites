import { metadataCorsOptionsRequestHandler } from "mcp-handler";

import { getAuthorizationServerMetadata } from "@/lib/oauth/metadata";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getAuthorizationServerMetadata(), {
    headers: {
      "Cache-Control": "max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
