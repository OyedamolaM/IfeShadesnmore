import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../pages/LegalPage.jsx";

export const Route = createFileRoute("/terms-of-service")({
  head: () => {
    const siteUrl = getSiteUrl();
    return {
      meta: [
        { title: "Terms of Service | IfeShades & More" },
        { name: "description", content: "Review the terms for shopping with IfeShades & More, including orders, payment, and support." },
        { property: "og:title", content: "Terms of Service | IfeShades & More" },
        { property: "og:description", content: "Review the terms for shopping with IfeShades & More, including orders, payment, and support." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${siteUrl}/terms-of-service` },
        { name: "twitter:card", content: "summary" }
      ],
      links: [{ rel: "canonical", href: `${siteUrl}/terms-of-service` }]
    };
  },
  component: () => <LegalPage type="terms" />
});

function getSiteUrl() {
  return String(import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}
