import { DesignPreviewGate } from "../DesignPreviewGate";
import { PasswordProtectedPage } from "@/components/site/PasswordProtectedPage";
import { PublicSite } from "@/components/site/PublicSite";
import {
  getCachedPageBySlug,
  getCachedPublishedPageSlugs,
  getCachedSiteConfig,
} from "@/lib/cache/public-site-data";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isPagePasswordProtected } from "@/lib/pages/password-status";
import { loadPublicSiteView } from "@/lib/pages/public-view";
import { isPageHidden } from "@/lib/pages/visibility";
import { resolvePublishedPageView } from "@/lib/pages/publish";

/** Cache until publish triggers on-demand revalidation. */
export const revalidate = false;

/** Pre-render published pages at build time; new slugs still work at runtime. */
export const dynamicParams = true;

export async function generateStaticParams() {
  if (!isFirebaseAdminConfigured()) return [];

  const slugs = await getCachedPublishedPageSlugs();
  return slugs.map((slug) => {
    const normalized = (slug || "").replace(/^\/+|\/+$/g, "");
    if (!normalized) return { slug: undefined };
    return { slug: normalized.split("/") };
  });
}

export async function generateMetadata({ params }) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join("/") || "";

  if (!isFirebaseAdminConfigured()) {
    return { title: "Parish Website" };
  }

  const page = await getCachedPageBySlug(slug);
  const publicPage = resolvePublishedPageView(page);
  if (isPageHidden(publicPage)) {
    return { title: "Page not found" };
  }

  // Do not call cookies() here — this route is statically cached.
  if (isPagePasswordProtected(page)) {
    return {
      title: publicPage?.title || "Protected page",
      robots: { index: false, follow: false },
    };
  }

  const site = await getCachedSiteConfig();
  return {
    title: publicPage?.seo?.title || publicPage?.title || site?.name || "Parish",
    description: publicPage?.seo?.description || site?.seo?.description,
  };
}

export default async function PublicPage({ params }) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join("/") || "";

  if (!isFirebaseAdminConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Firebase Admin is not configured. Add <code>FIREBASE_ADMIN_*</code> credentials to{" "}
          <code>.env.local</code> to serve public pages.
        </div>
      </div>
    );
  }

  const page = await getCachedPageBySlug(slug);
  const publicPage = resolvePublishedPageView(page);

  if (!publicPage || isPageHidden(publicPage)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-zinc-500">
          <a href="/login" className="text-blue-600 underline">Sign in</a> to create pages.
        </p>
      </div>
    );
  }

  // Password pages stay static: cookie check happens in the client + API route.
  if (isPagePasswordProtected(page)) {
    return (
      <PasswordProtectedPage pageId={page.id} pageTitle={publicPage.title} slug={slug} />
    );
  }

  const view = await loadPublicSiteView(slug);
  if (!view.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
      </div>
    );
  }

  return (
    <DesignPreviewGate slug={slug}>
      <PublicSite {...view.props} />
    </DesignPreviewGate>
  );
}
