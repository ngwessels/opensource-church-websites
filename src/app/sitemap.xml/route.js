import { isCrawlerUserAgent } from "@/lib/seo/crawler";
import { formatSitemapHtml, getSitemapXmlContent } from "@/lib/seo/sitemap-content";

export async function GET(request) {
  const body = await getSitemapXmlContent();
  const userAgent = request.headers.get("user-agent");

  if (isCrawlerUserAgent(userAgent)) {
    return new Response(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  }

  return new Response(formatSitemapHtml(body), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
