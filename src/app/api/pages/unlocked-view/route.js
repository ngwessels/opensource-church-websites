import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { loadPublicSiteView } from "@/lib/pages/public-view";
import {
  PAGE_UNLOCK_COOKIE_NAME,
  isPageUnlockedInCookie,
} from "@/lib/pages/unlock-cookie";

export const runtime = "nodejs";

/**
 * GET ?slug= — return PublicSite props when the unlock cookie is valid for a
 * password-protected page. Used by the client gate so the RSC stays static.
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    const view = await loadPublicSiteView(slug);
    if (!view.ok) {
      return NextResponse.json({ error: view.error }, { status: view.status });
    }

    if (view.passwordProtected) {
      const cookieStore = await cookies();
      const unlocked = isPageUnlockedInCookie(
        cookieStore.get(PAGE_UNLOCK_COOKIE_NAME)?.value,
        view.pageId,
      );
      if (!unlocked) {
        return NextResponse.json(
          {
            unlocked: false,
            pageId: view.pageId,
            pageTitle: view.pageTitle,
          },
          { status: 401 },
        );
      }
    }

    return NextResponse.json({
      unlocked: true,
      pageId: view.pageId,
      pageTitle: view.pageTitle,
      props: view.props,
    });
  } catch (err) {
    console.error("[pages/unlocked-view]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
