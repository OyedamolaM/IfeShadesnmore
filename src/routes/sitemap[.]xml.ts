import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { blogPath, getSiteUrl, getStorefrontPayload, productPath } = await import("../../server/apiCore.js");
        const siteUrl = getSiteUrl();
        const payload = await getStorefrontPayload();
        const urls = [
          { loc: `${siteUrl}/`, priority: "1.0" },
          { loc: `${siteUrl}/privacy-policy`, priority: "0.4" },
          { loc: `${siteUrl}/terms-of-service`, priority: "0.4" },
          ...(payload.products || []).map((product) => ({
            loc: `${siteUrl}${productPath(product)}`,
            priority: product.section === "bestseller" ? "0.8" : "0.7"
          })),
          ...(payload.blogs || []).map((blog) => ({
            loc: `${siteUrl}${blogPath(blog)}`,
            priority: "0.6"
          }))
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((entry) => `  <url><loc>${escapeXml(entry.loc)}</loc><priority>${entry.priority}</priority></url>`)
          .join("\n")}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
      }
    }
  }
});

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;"
    };
    return entities[char];
  });
}
