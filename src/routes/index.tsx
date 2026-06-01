import { createFileRoute } from "@tanstack/react-router";
import App from "../App.jsx";
import { getInitialAppData } from "../serverFns";

export const Route = createFileRoute("/")({
  loader: () => getInitialAppData(),
  head: ({ loaderData }) => {
    const settings = loaderData?.storefront?.settings;
    const title = `${settings?.brandName || "IfeShades & More"} | Stylish eyewear and accessories`;
    const description = "Shop stylish sunglasses, optical frames, and fashion eyewear from IfeShades & More in Lagos.";
    const siteUrl = getSiteUrl();
    const image = absoluteUrl(settings?.heroImage || "/hero/hero-candidate2.jpg", siteUrl);
    return {
      meta: [
        { title },
        { name: "description", content: description },
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
            name: settings?.brandName || "IfeShades & More",
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
            name: settings?.brandName || "IfeShades & More",
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
  const data = Route.useLoaderData();
  return <App screen="home" initialStorefront={data.storefront} initialUser={data.user} />;
}

function getSiteUrl() {
  return String(import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function absoluteUrl(value: string, siteUrl: string) {
  if (!value) return siteUrl;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}
