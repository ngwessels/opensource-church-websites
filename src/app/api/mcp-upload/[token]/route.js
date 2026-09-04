import { NextResponse } from "next/server";

import {
  finalizeMediaUploadLinkSigned,
  getMediaUploadLinkPublic,
  prepareMediaUploadLinkSigned,
} from "@/lib/cms/media";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * @param {unknown} err
 * @param {number} [fallbackStatus]
 */
function errorResponse(err, fallbackStatus = 400) {
  const message = err instanceof Error ? err.message : "Upload failed";
  let status = fallbackStatus;
  if (/not found/i.test(message)) status = 404;
  else if (/expired/i.test(message)) status = 410;
  else if (/already used/i.test(message)) status = 409;
  else if (/too large|exceeds/i.test(message)) status = 413;
  return NextResponse.json(
    { error: message, message, agentInstructions: message, uploadVerified: false },
    { status },
  );
}

async function tokenFromParams(params) {
  const { token } = await params;
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Upload link not found");
  }
  return token.trim();
}

export async function GET(_request, { params }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }
    const token = await tokenFromParams(params);
    const data = await getMediaUploadLinkPublic(token);
    const status = data.status === "not_found" ? 404 : data.status === "expired" ? 410 : 200;
    return NextResponse.json(data, { status });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request, { params }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }
    const token = await tokenFromParams(params);
    const body = await request.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "prepare_signed") {
      const result = await prepareMediaUploadLinkSigned(token, {
        filename: typeof body.filename === "string" ? body.filename : "upload",
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "application/octet-stream",
        sizeBytes: Number(body.sizeBytes),
        origin: request.headers.get("origin") || undefined,
      });
      return NextResponse.json(result);
    }

    if (action === "finalize_signed") {
      const result = await finalizeMediaUploadLinkSigned(token);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Unknown action. Use prepare_signed or finalize_signed." },
      { status: 400 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
