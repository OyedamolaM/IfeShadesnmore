import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../pages/LegalPage.jsx";

export const Route = createFileRoute("/privacy-policy")({
  head: () => {
    const siteUrl = getSiteUrl();
    return {
      meta: [
        { title: "Privacy Policy | IfeShades & More" },
        { name: "description", content: "Read how IfeShades & More collects, uses, and protects customer information." },
        { property: "og:title", content: "Privacy Policy | IfeShades & More" },
        { property: "og:description", content: "Read how IfeShades & More collects, uses, and protects customer information." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${siteUrl}/privacy-policy` },
        { name: "twitter:card", content: "summary" }
      ],
      links: [{ rel: "canonical", href: `${siteUrl}/privacy-policy` }]
    };
  },
  component: () => <LegalPage type="privacy" />
});

function getSiteUrl() {
  return String(import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}
