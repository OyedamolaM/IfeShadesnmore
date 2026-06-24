import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import ProductMedia from "../../components/product/ProductMedia.jsx";
import { toPrice } from "../../utils/format";
import { getProductPageData } from "../../serverFns";

export const Route = createFileRoute("/products/$slugId")({
  loader: async ({ params }) => {
    const product = await getProductPageData({ data: params.slugId });
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData, params }) => {
    const product = loaderData;
    const siteUrl = getSiteUrl();
    const url = `${siteUrl}/products/${params.slugId}`;
    if (!product) {
      return {
        meta: [
          { title: "Product not found | IfeShades & More" },
          { name: "robots", content: "noindex,nofollow" }
        ],
        links: [{ rel: "canonical", href: url }]
      };
    }
    const title = `${product.name} | IfeShades & More`;
    const description =
      product.description || `Shop ${product.name} from IfeShades & More. Stylish eyewear with secure checkout.`;
    const image = absoluteUrl(normalizeProductImagePath(product.image || "/hero/UnisexGlasses.jpg"), siteUrl);
    const imageAlt = `${product.name} product image`;
    const imageType = inferImageType(image);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:secure_url", content: image },
        { property: "og:image:alt", content: imageAlt },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "1200" },
        ...(imageType ? [{ property: "og:image:type", content: imageType }] : []),
        { property: "product:price:amount", content: String(product.price) },
        { property: "product:price:currency", content: "NGN" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
        { name: "twitter:image:alt", content: imageAlt }
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description,
            image,
            sku: product.id,
            brand: {
              "@type": "Brand",
              name: "IfeShades & More"
            },
            offers: {
              "@type": "Offer",
              priceCurrency: "NGN",
              price: product.price,
              availability:
                product.availability === "out_of_stock"
                  ? "https://schema.org/OutOfStock"
                  : "https://schema.org/InStock",
              url
            }
          })
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
              { "@type": "ListItem", position: 2, name: product.name, item: url }
            ]
          })
        }
      ]
    };
  },
  component: ProductPage
});

function ProductPage() {
  const product = Route.useLoaderData();
  const availability = product.availability === "out_of_stock" ? "Out of stock" : product.availability === "preorder" ? "Preorder" : "In stock";

  return (
    <div className="page product-seo-page">
      <main className="site-shell product-seo-shell">
        <section className="container product-seo-inner">
          <Link className="legal-back-link" to="/">
            Back to store
          </Link>
          <div className="product-seo-grid">
            <div className="product-seo-media">
              <ProductMedia product={product} />
            </div>
            <article className="product-seo-content">
              <p className={`availability-pill availability-${product.availability}`}>{availability}</p>
              <h1>{product.name}</h1>
              <p className="product-seo-price">{toPrice(product.price)}</p>
              <p>{product.description || "Premium frame with modern finish and lasting comfort."}</p>
              {product.preorderNote ? <p className="preorder-note">{product.preorderNote}</p> : null}
              <ul className="product-meta-list">
                {(product.detailBullets || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="primary-action product-seo-action" to="/" hash="shop">
                Shop this collection
              </Link>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function getSiteUrl() {
  return String(import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function absoluteUrl(value: string, siteUrl: string) {
  if (!value) return siteUrl;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function normalizeProductImagePath(value: string) {
  const src = String(value || "").trim();
  if (src === "/hero/female-glasses.jpg") return "/hero/Female-glasses.jpg";
  return src;
}

function inferImageType(value: string) {
  const pathname = (() => {
    try {
      return new URL(value).pathname.toLowerCase();
    } catch {
      return String(value || "").toLowerCase();
    }
  })();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  return "";
}
