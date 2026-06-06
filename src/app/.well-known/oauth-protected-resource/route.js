import { metadataCorsOptionsRequestHandler } from "mcp-handler";

import { getProtectedResourceMetadata } from "@/lib/oauth/metadata";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getProtectedResourceMetadata(), {
    headers: {
      "Cache-Control": "max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
