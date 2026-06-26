import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import ProductMedia from "../../components/product/ProductMedia.jsx";
import CartDrawer from "../../components/cart/CartDrawer.jsx";
import CheckoutModal from "../../components/cart/CheckoutModal.jsx";
import { toPrice } from "../../utils/format";
import { getProductPageData } from "../../serverFns";
import { DEFAULT_PRODUCT_DETAIL_BULLETS } from "../../constants/storefront";
import { addWishlistItem, fetchMe, fetchStorefront } from "../../utils/api";
import { getStoredThemeVariant, persistThemeVariant } from "../../utils/themePreference";
import { CartProvider, useCart } from "../../hooks/cart";
import { useCheckout } from "../../hooks/useCheckout";
import { normalizeAvailability } from "../../utils/cart";
import StoreNavbar from "../../components/layout/StoreNavbar.jsx";

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
    const baseDescription =
      product.description || `Shop ${product.name} from IfeShades & More. Stylish eyewear with secure checkout.`;
    const description = `${baseDescription} Explore anti-blue glasses, photochromic glasses, and stylish frames for laptop users, phone users, tech workers, office professionals, and heavy screen use.`;
    const image = getProductShareImageUrl(product, siteUrl);
    const imageAlt = `${product.name} product image`;
    const imageType = inferImageType(product.image || image);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "keywords", content: `${product.name}, anti-blue glasses, photochromic glasses, laptop glasses, phone screen glasses, blue light glasses, tech worker glasses, office eyewear, IfeShadesnMore` },
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
  component: ProductPageRoot
});

// CartProvider wraps here so useCart() has context on both SSR and client
function ProductPageRoot() {
  return (
    <CartProvider>
      <ProductPage />
    </CartProvider>
  );
}

function ProductPage() {
  const product = Route.useLoaderData();
  const [quantityInput, setQuantityInput] = useState("1");
  const [toast, setToast] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [isSavingWishlist, setIsSavingWishlist] = useState(false);
  const [themeVariant, setThemeVariant] = useState("v1");
  const [isThemeHydrated, setIsThemeHydrated] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [storefrontProducts, setStorefrontProducts] = useState([product]);
  const [shippingTiers, setShippingTiers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const brandName = "IfeShadesnMore";
  const styleVariant = themeVariant;
  const onStyleVariantChange = setThemeVariant;
  const primaryShopTargetId = "shop";
  const onOpenCart = () => setShowCart(true);
  const onOpenProfile = () => { window.location.href = "/account"; };
  const onOpenAdmin = () => { window.location.href = "/admin"; };

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
  const productImages = normalizeProductImages(product);
  const selectedImageIndex = Math.max(0, Math.min(activeImageIndex, productImages.length - 1));
  const selectedProduct =
    productImages.length > 0
      ? { ...product, image: productImages[selectedImageIndex], images: productImages, mainImageIndex: selectedImageIndex }
      : product;

  const catalogProducts = useMemo(() => {
    const productMap = new Map();
    [product, ...storefrontProducts].filter(Boolean).forEach((item) => {
      productMap.set(item.id, item);
    });
    return [...productMap.values()];
  }, [product, storefrontProducts]);

  const productsById = useMemo(() => {
    const map = new Map();
    catalogProducts.forEach((item) => map.set(item.id, item));
    return map;
  }, [catalogProducts]);

  // Same hook as StorefrontPage — reads from the same CartProvider/localStorage
  const { cart, cartCount, addToCart: addToCartRaw, setCartQuantity } = useCart();

  const cartItems = useMemo(() => {
    return cart
      .map((entry) => ({
        product: productsById.get(entry.productId),
        quantity: entry.quantity
      }))
      .filter((item) => item.product);
  }, [cart, productsById]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => sum + (Number(item.product.price) || 0) * item.quantity,
      0
    );
  }, [cartItems]);

  const onNavigate = (path) => { window.location.href = path; };

  const {
    checkoutForm,
    accountAddresses,
    activeShippingTiers,
    selectedShippingTier,
    shippingFee,
    checkoutTotal,
    showCheckout,
    setShowCheckout,
    checkoutError,
    checkoutNotice,
    isSubmittingCheckout,
    openCheckout: openCheckoutRaw,
    onFieldChange,
    handleCheckoutSubmit
  } = useCheckout({
    currentUser,
    cartItems,
    shippingTiers,
    onNavigate
  });

  useEffect(() => {
    setActiveImageIndex(Math.max(0, Number(product?.mainImageIndex) || 0));
  }, [product?.id, product?.mainImageIndex]);

  useEffect(() => {
    if (!toast && !shareStatus) return undefined;
    const timer = window.setTimeout(() => {
      setToast("");
      setShareStatus("");
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toast, shareStatus]);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([fetchStorefront(), fetchMe()]).then(([storefrontResult, meResult]) => {
      if (!isMounted) return;
      if (storefrontResult.status === "fulfilled") {
        const payload = storefrontResult.value || {};
        if (Array.isArray(payload.products)) setStorefrontProducts(payload.products);
        setShippingTiers(Array.isArray(payload.settings?.shippingTiers) ? payload.settings.shippingTiers : []);
      }
      if (meResult.status === "fulfilled") {
        setCurrentUser(meResult.value?.user || null);
      }
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    setThemeVariant(getStoredThemeVariant());
    setIsThemeHydrated(true);
  }, []);

  useEffect(() => {
    if (!isThemeHydrated) return;
    persistThemeVariant(themeVariant);
  }, [isThemeHydrated, themeVariant]);

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
    addToCartRaw(product.id, quantity);
    setToast(
      availability === "preorder" ? `${product.name} added as preorder.` : `${product.name} added to cart.`
    );
  };

  const openCheckout = async () => {
    if (cartItems.length === 0) return;
    if (!currentUser) {
      window.location.href = `/account/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const opened = await openCheckoutRaw();
    if (opened) setShowCart(false);
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
    <div className={`page product-seo-page preview-storefront preview-${themeVariant}`}>
      <StoreNavbar
        brandName={brandName}
        cartCount={cartCount}
        currentUser={currentUser}
        styleVariant={styleVariant}
        onStyleVariantChange={onStyleVariantChange}
        onOpenCart={onOpenCart}
        onOpenProfile={onOpenProfile}
        onOpenAdmin={onOpenAdmin}
        showAdmin={currentUser?.role === "admin"}
        primaryShopTargetId={primaryShopTargetId}
      />
      <main className="site-shell product-seo-shell">
        <section className="container product-seo-inner">
          <div className="product-seo-grid">
            <div className="product-seo-media">
              <div className="product-gallery-stage">
                <ProductMedia product={selectedProduct} />
                {productImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="product-gallery-nav product-gallery-prev"
                      onClick={() =>
                        setActiveImageIndex((current) => (current - 1 + productImages.length) % productImages.length)
                      }
                      aria-label="Show previous product image"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      className="product-gallery-nav product-gallery-next"
                      onClick={() =>
                        setActiveImageIndex((current) => (current + 1) % productImages.length)
                      }
                      aria-label="Show next product image"
                    >
                      &gt;
                    </button>
                  </>
                ) : null}
              </div>
              {productImages.length > 1 ? (
                <div className="product-gallery-thumbs" aria-label="Product images">
                  {productImages.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={index === selectedImageIndex ? "is-active" : ""}
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Show product image ${index + 1}`}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
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
              </div>
            </article>
          </div>
        </section>
      </main>
      <ProductPageFooter />
      {toast || shareStatus ? (
        <p className="purchase-toast" role="status" aria-live="polite">
          {toast || shareStatus}
        </p>
      ) : null}
      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        items={cartItems}
        subtotal={cartSubtotal}
        onDecrement={(id) => {
          const item = cartItems.find((entry) => entry.product.id === id);
          setCartQuantity(id, (item?.quantity || 1) - 1);
        }}
        onIncrement={(id) => {
          const item = cartItems.find((entry) => entry.product.id === id);
          setCartQuantity(id, (item?.quantity || 0) + 1);
        }}
        onRemove={(id) => setCartQuantity(id, 0)}
        onOpenCheckout={openCheckout}
      />
      <CheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        items={cartItems}
        subtotal={cartSubtotal}
        shippingTiers={activeShippingTiers}
        selectedShippingTierId={selectedShippingTier?.id || ""}
        shippingFee={shippingFee}
        total={checkoutTotal}
        form={checkoutForm}
        savedAddresses={accountAddresses}
        onFieldChange={onFieldChange}
        onSubmit={handleCheckoutSubmit}
        checkoutError={checkoutError}
        checkoutNotice={checkoutNotice}
        isSubmitting={isSubmittingCheckout}
      />
    </div>
  );
}

function ProductPageFooter() {
  return (
    <footer className="site-footer product-page-footer">
      <div className="container footer-inner">
        <div className="footer-links">
          <Link to="/privacy-policy" className="footer-link-button">Privacy Policy</Link>
          <span>|</span>
          <Link to="/terms-of-service" className="footer-link-button">Terms of Service</Link>
        </div>
        <div className="footer-contact-stack">
          <div className="footer-contact-links">
            <a href="mailto:oluborodedeborah2000@gmail.com" target="_blank" rel="noopener noreferrer">
              oluborodedeborah2000@gmail.com
            </a>
            <span>|</span>
            <a href="tel:09063556765">09063556765</a>
            <span>|</span>
            <a
              href="https://wa.me/2349063556765?text=Hello%20Ife_ShadesnMore%2C%20I%20would%20like%20to%20make%20an%20order."
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </div>
          <p>1, Sunday Akinbo Str, command Ipaja, Lagos</p>
        </div>
        <div className="footer-socials" aria-label="Social media links">
          <a href="https://www.facebook.com/share/1CJYVRj8hQ/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <SocialIcon type="facebook" />
          </a>
          <a href="https://www.instagram.com/ife_shadesnmore?igsh=MW90cDlmdXRzZzRncQ==" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <SocialIcon type="instagram" />
          </a>
          <a href="https://www.tiktok.com/@ife_shadesnmore?_r=1&_t=ZS-946goatDDNp" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
            <SocialIcon type="tiktok" />
          </a>
        </div>
      </div>
    </footer>
  );
}

function getSiteUrl(runtimeSiteUrl?: string) {
  return String(
    runtimeSiteUrl || import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
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

function normalizeProductImages(product) {
  const source = Array.isArray(product?.images) ? product.images : [];
  const candidates = [...source, product?.image]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  return [...new Set(candidates)].slice(0, 6);
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

function SocialIcon({ type }) {
  if (type === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.4 8.1h2.3V5.2h-2.3c-2.3 0-3.7 1.6-3.7 3.8v2H7.5v2.8h2.2v5.1h2.9v-5.1h2.5l.4-2.8h-2.9V9.4c0-.8.4-1.3 1.1-1.3Z" />
      </svg>
    );
  }
  if (type === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4.2" />
        <circle cx="12" cy="12" r="3.7" />
        <circle cx="17.2" cy="6.8" r="1.1" />
      </svg>
    );
  }
  if (type === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.8 3.5c.6 1.6 1.8 2.8 3.4 3.4v2.6a6.1 6.1 0 0 1-3.4-1v5.6a5.8 5.8 0 1 1-5-5.8v2.7a3.2 3.2 0 1 0 2.4 3.1V3.5h2.6Z" />
      </svg>
    );
  }
  return null;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18 8a3 3 0 1 0-2.82-4H15a3 3 0 0 0 .62 1.82L8.9 9.2a3 3 0 1 0 0 5.6l6.72 3.38A3 3 0 1 0 17 16a3 3 0 0 0-1.82.62L8.46 13.2a3.1 3.1 0 0 0 0-2.4l6.72-3.38A3 3 0 0 0 18 8Z" />
    </svg>
  );
}
