import { unsubscribeByToken } from "@/lib/email-list/subscribers.server";
import { escapeHtmlText } from "@/lib/email-list/html";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public unsubscribe link carried by every list email.
 *
 * GET  — confirmation page, so link scanners never opt somebody out
 * POST — performs the unsubscribe, which also satisfies RFC 8058 one-click
 *        unsubscribe from the `List-Unsubscribe-Post` header
 */
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";

  if (!token) {
    return htmlResponse(
      page({
        title: "Link is incomplete",
        body: "<p>This unsubscribe link is missing its code. Please use the link from the bottom of the email.</p>",
      }),
      400,
    );
  }

  return htmlResponse(
    page({
      title: "Unsubscribe from parish email",
      body: `
        <p>Click below and we will stop sending you parish email. You can always ask the parish office to add you again.</p>
        <form method="post" action="/api/email-list/unsubscribe">
          <input type="hidden" name="token" value="${escapeHtmlText(token)}" />
          <button type="submit">Unsubscribe</button>
        </form>
      `,
    }),
  );
}

export async function POST(request) {
  if (!isFirebaseAdminConfigured()) {
    return htmlResponse(
      page({
        title: "Unsubscribe unavailable",
        body: "<p>This site cannot process the request right now. Please contact the parish office.</p>",
      }),
      503,
    );
  }

  const token = await readToken(request);
  const result = token
    ? await unsubscribeByToken(token)
    : { ok: false, email: "", alreadyUnsubscribed: false };

  if (!result.ok) {
    return htmlResponse(
      page({
        title: "Link not recognised",
        body: "<p>This unsubscribe link is no longer valid. Contact the parish office and we will remove you from the list.</p>",
      }),
      404,
    );
  }

  return htmlResponse(
    page({
      title: result.alreadyUnsubscribed ? "You were already unsubscribed" : "You are unsubscribed",
      body: `<p><strong>${escapeHtmlText(result.email)}</strong> will not receive further parish email.</p>`,
    }),
  );
}

/**
 * Mail clients send one-click unsubscribes as a form post, and the
 * confirmation page posts the same field, so both paths look alike here.
 *
 * @param {Request} request
 * @returns {Promise<string>}
 */
async function readToken(request) {
  const urlToken = new URL(request.url).searchParams.get("token");
  if (urlToken) return urlToken.trim();

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return typeof body.token === "string" ? body.token.trim() : "";
  }

  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  return typeof token === "string" ? token.trim() : "";
}

/**
 * @param {string} body
 * @param {number} [status]
 */
function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * @param {{ title: string, body: string }} input
 * @returns {string}
 */
function page({ title, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtmlText(title)}</title>
    <style>
      body { margin:0; background:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; color:#27272a; }
      main { max-width:520px; margin:12vh auto; background:#fff; border:1px solid #e4e4e7; border-radius:12px; padding:32px; }
      h1 { font-size:20px; margin:0 0 12px; }
      p { line-height:1.6; margin:0 0 16px; }
      button { background:#18181b; color:#fff; border:0; border-radius:8px; padding:12px 20px; font-size:15px; cursor:pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtmlText(title)}</h1>
      ${body}
    </main>
  </body>
</html>`;
}
