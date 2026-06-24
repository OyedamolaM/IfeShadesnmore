import { useEffect, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import ProductMedia from "../../components/product/ProductMedia.jsx";
import { toPrice } from "../../utils/format";
import { getProductPageData } from "../../serverFns";
import { CART_STORAGE_KEY, DEFAULT_PRODUCT_DETAIL_BULLETS } from "../../constants/storefront";
import { addWishlistItem } from "../../utils/api";

export const Route = createFileRoute("/products/$slugId")({
  loader: async ({ params }) => {
    const product = await getProductPageData({ data: params.slugId });
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData, params }) => {
    const product = loaderData;
    const siteUrl = getSiteUrl(product?.seoSiteUrl);
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
    const image = getProductShareImageUrl(product, siteUrl);
    const imageAlt = `${product.name} product image`;
    const imageType = inferImageType(product.image || image);
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
  const [quantityInput, setQuantityInput] = useState("1");
  const [toast, setToast] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [isSavingWishlist, setIsSavingWishlist] = useState(false);
  const availability = normalizeAvailability(product.availability);
  const availabilityLabel =
    availability === "out_of_stock" ? "Out of Stock" : availability === "preorder" ? "Preorder" : "In Stock";
  const isOutOfStock = availability === "out_of_stock";
  const isPreorder = availability === "preorder";
  const description =
    (product.description || "").trim() || "Premium frame with modern finish and lasting comfort.";
  const detailBullets = (Array.isArray(product.detailBullets) ? product.detailBullets : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const resolvedDetailBullets = detailBullets.length > 0 ? detailBullets : DEFAULT_PRODUCT_DETAIL_BULLETS;
  const productUrl =
    typeof window === "undefined"
      ? `/products/${productSlugId(product)}`
      : `${window.location.origin}/products/${productSlugId(product)}`;

  useEffect(() => {
    if (!toast && !shareStatus) return undefined;
    const timer = window.setTimeout(() => {
      setToast("");
      setShareStatus("");
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toast, shareStatus]);

  const resolveQuantity = () => {
    const parsed = Number.parseInt(String(quantityInput || "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const handleAddToCart = () => {
    if (isOutOfStock) {
      setToast(`${product.name} is currently out of stock.`);
      return;
    }

    const quantity = resolveQuantity();
    const nextCart = updateStoredCart(product.id, quantity);
    setToast(
      availability === "preorder" ? `${product.name} added as preorder.` : `${product.name} added to cart.`
    );
    window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, newValue: JSON.stringify(nextCart) }));
  };

  const handleWishlist = async () => {
    if (!product?.id || isSavingWishlist) return;
    setIsSavingWishlist(true);
    try {
      await addWishlistItem(product.id);
      setToast(`${product.name} saved to wishlist.`);
    } catch (error) {
      if (error?.status === 401) {
        window.location.href = `/account/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setToast(error?.message || "Could not save to wishlist.");
    } finally {
      setIsSavingWishlist(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: product.name || "IfeShadesnMore product",
      text: product.name ? `View ${product.name} on IfeShadesnMore` : "View this product on IfeShadesnMore",
      url: productUrl
    };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(shareData);
        setShareStatus("Shared.");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(productUrl);
        setShareStatus("Product link copied.");
        return;
      }
      setShareStatus(productUrl);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setShareStatus("Could not share. Copy the product page link from your browser.");
    }
  };

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
              <div className="product-availability-row">
                <span className={`availability-pill availability-${availability}`}>{availabilityLabel}</span>
              </div>
              <h1>{product.name}</h1>
              <p className="product-seo-price">{toPrice(product.price)}</p>
              <p className="product-modal-description">{description}</p>
              {product.preorderNote ? <p className="preorder-note">{product.preorderNote}</p> : null}
              <ul className="product-meta-list">
                {resolvedDetailBullets.map((item, index) => (
                  <li key={`${product.id || "product"}-detail-bullet-${index}`}>{item}</li>
                ))}
              </ul>
              {!isOutOfStock ? (
                <label className="quantity-control">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={quantityInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (!/^\d*$/.test(nextValue)) return;
                      setQuantityInput(nextValue);
                    }}
                    onBlur={() => {
                      setQuantityInput(String(resolveQuantity()));
                    }}
                  />
                  <button type="button" className="secondary-action detail-cart-button" onClick={handleAddToCart}>
                    {isPreorder ? "Add Preorder" : "Add to Cart"}
                  </button>
                </label>
              ) : (
                <p className="product-modal-readonly">This product is currently out of stock.</p>
              )}
              <div className="product-modal-actions">
                <button type="button" className="secondary-action product-action-share" onClick={handleShare}>
                  <ShareIcon />
                  Share
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleWishlist}
                  disabled={isSavingWishlist}
                >
                  {isSavingWishlist ? "Saving..." : "Save to Wishlist"}
                </button>
                <Link className="secondary-action product-seo-action" to="/" hash="shop">
                  Back to Shop
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      {toast || shareStatus ? (
        <p className="purchase-toast" role="status" aria-live="polite">
          {toast || shareStatus}
        </p>
      ) : null}
    </div>
  );
}

function getSiteUrl(runtimeSiteUrl?: string) {
  return String(runtimeSiteUrl || import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function absoluteUrl(value: string, siteUrl: string) {
  if (!value) return siteUrl;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function getProductShareImageUrl(product, siteUrl: string) {
  if (!product?.id) return absoluteUrl(normalizeProductImagePath(product?.image || "/hero/UnisexGlasses.jpg"), siteUrl);
  const image = normalizeProductImagePath(product.image || "");
  if (/^https?:\/\//i.test(image)) return image;
  if (image && !image.startsWith("data:")) return absoluteUrl(image, siteUrl);
  return absoluteUrl(`/api/products/${encodeURIComponent(product.id)}/image`, siteUrl);
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

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "out_of_stock" || source === "preorder" || source === "in_stock") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function productSlugId(product) {
  const slug =
    String(product?.name || product?.id || "product")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "product";
  return `${slug}--${encodeURIComponent(product.id)}`;
}

function parseStoredCart(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        productId: String(entry?.productId || "").trim(),
        quantity: Math.max(0, Number(entry?.quantity) || 0)
      }))
      .filter((entry) => entry.productId && entry.quantity > 0);
  } catch {
    return [];
  }
}

function updateStoredCart(productId, quantity) {
  if (typeof window === "undefined") return [];
  const current = parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
  const index = current.findIndex((entry) => entry.productId === productId);
  const next =
    index === -1
      ? [...current, { productId, quantity }]
      : current.map((entry, idx) =>
          idx === index ? { ...entry, quantity: entry.quantity + quantity } : entry
        );
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18 8a3 3 0 1 0-2.82-4H15a3 3 0 0 0 .62 1.82L8.9 9.2a3 3 0 1 0 0 5.6l6.72 3.38A3 3 0 1 0 17 16a3 3 0 0 0-1.82.62L8.46 13.2a3.1 3.1 0 0 0 0-2.4l6.72-3.38A3 3 0 0 0 18 8Z" />
    </svg>
  );
}
