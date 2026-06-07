import { isCrawlerUserAgent } from "@/lib/seo/crawler";
import {
  formatRobotsHtml,
  getRobotsTxtContent,
} from "@/lib/seo/robots-content";

export async function GET(request) {
  const body = await getRobotsTxtContent();
  const userAgent = request.headers.get("user-agent");

  if (isCrawlerUserAgent(userAgent)) {
    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  }

  return new Response(formatRobotsHtml(body), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
