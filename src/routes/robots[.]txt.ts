import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { getSiteUrl } = await import("../../server/apiCore.js");
        const siteUrl = getSiteUrl();
        return new Response(
          [
            "User-agent: *",
            "Allow: /",
            "Disallow: /admin",
            "Disallow: /admin/",
            "Disallow: /account",
            "Disallow: /account/",
            "Disallow: /payment/",
            "",
            `Sitemap: ${siteUrl}/sitemap.xml`,
            ""
          ].join("\n"),
          { headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
    }
  }
});
