import { createFileRoute } from "@tanstack/react-router";
import App from "../App.jsx";

export const Route = createFileRoute("/")({
  head: () => {
    const brandName = "IfeShades & More";
    const title = "IfeShades & More | Anti-blue and photochromic glasses in Nigeria";
    const description = "Shop anti-blue glasses, photochromic glasses, sunglasses, and optical frames for laptop users, phone users, tech workers, office professionals, and anyone who spends long hours on screens.";
    const siteUrl = getSiteUrl();
    const image = absoluteUrl("/hero/hero-candidate2.jpg", siteUrl);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "keywords", content: "anti-blue glasses Nigeria, photochromic glasses Nigeria, laptop glasses, phone screen glasses, blue light glasses, glasses for tech workers, office glasses, computer glasses Lagos, IfeShadesnMore" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: siteUrl },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image }
      ],
      links: [{ rel: "canonical", href: siteUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: brandName,
            url: siteUrl,
            potentialAction: {
              "@type": "SearchAction",
              target: `${siteUrl}/?search={search_term_string}`,
              "query-input": "required name=search_term_string"
            }
          })
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: brandName,
            url: siteUrl,
            image
          })
        }
      ]
    };
  },
  component: HomeRoute
});

function HomeRoute() {
  return <App screen="home" />;
}

function getSiteUrl() {
  return String(import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function absoluteUrl(value: string, siteUrl: string) {
  if (!value) return siteUrl;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}
