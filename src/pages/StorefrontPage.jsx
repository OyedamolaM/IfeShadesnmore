import { useEffect, useMemo, useState } from "react";
import ArrivalsSection from "../components/sections/ArrivalsSection";
import ContactSection from "../components/sections/ContactSection";
import ProductDetailsModal from "../components/product/ProductDetailsModal";
import CartDrawer from "../components/cart/CartDrawer";
import CheckoutModal from "../components/cart/CheckoutModal";
import PreviewStorefront, { PreviewSupportSections } from "./PreviewStorefront";
import { addWishlistItem, createSubscription, } from "../utils/api";
import { getStoredThemeVariant, persistThemeVariant } from "../utils/themePreference";
import { useCart } from "../hooks/cart";
import { useCheckout } from "../hooks/useCheckout";
import { buildLoginRedirect, normalizeAvailability } from "../utils/cart";

const NEWSLETTER_DISMISS_MS = 24 * 60 * 60 * 1000;
const NEWSLETTER_POPUP_DELAY_MS = 90 * 1000;
const NEWSLETTER_DISMISSED_UNTIL_KEY = "ife_newsletter_dismissed_until";
const NEWSLETTER_SUBSCRIBED_KEY = "ife_newsletter_subscribed";

function getStoredNewsletterDismissedUntil() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(NEWSLETTER_DISMISSED_UNTIL_KEY) || 0) || 0;
}

function isNewsletterMarkedSubscribed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY) === "true";
}

function setNewsletterSubscribedFlag() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, "true");
  window.localStorage.removeItem(NEWSLETTER_DISMISSED_UNTIL_KEY);
}

function StorefrontPage({
  products,
  settings,
  heroSlides,
  blogs = [],
  currentUser,
  location,
  onNavigate,
  orderingEnabled = true,
  isAdminPreview = false
}) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCart, setShowCart] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showNewsletterPopup, setShowNewsletterPopup] = useState(false);
  const [newsletterPopupEmail, setNewsletterPopupEmail] = useState(() => currentUser?.email || "");
  const [isPopupSubscribing, setIsPopupSubscribing] = useState(false);
  const [pendingSearchFocus, setPendingSearchFocus] = useState(false);
  const [cartToast, setCartToast] = useState("");
  const [wishlistPendingProductId, setWishlistPendingProductId] = useState("");
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [previewStyle, setPreviewStyle] = useState("v1");
  const [isPreviewStyleHydrated, setIsPreviewStyleHydrated] = useState(false);

  useEffect(() => {
    setPreviewStyle(getStoredThemeVariant());
    setIsPreviewStyleHydrated(true);
  }, []);

  useEffect(() => {
    if (!isPreviewStyleHydrated) return;
    persistThemeVariant(previewStyle);
  }, [previewStyle, isPreviewStyleHydrated]);

  useEffect(() => {
    setNewsletterPopupEmail((current) => current || currentUser?.email || "");
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.isNewsletterSubscribed) return;
    setNewsletterSubscribedFlag();
    setShowNewsletterPopup(false);
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === "undefined" || isAdminPreview || isNewsletterMarkedSubscribed()) return undefined;
    if (getStoredNewsletterDismissedUntil() > Date.now()) return undefined;

    const timer = window.setTimeout(() => {
      if (!isNewsletterMarkedSubscribed() && getStoredNewsletterDismissedUntil() <= Date.now()) {
        setShowNewsletterPopup(true);
      }
    }, NEWSLETTER_POPUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isAdminPreview]);

  const productsById = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  // ---- Shared cart logic ----
  const { cart, cartCount, addToCart: addToCartRaw, setCartQuantity,  replaceCart,} =
    useCart();
  // ---- Shared checkout logic ----
  const cartItems = useMemo(() => {
  return cart
    .map((entry) => {
      const product = products.find(
        (product) => String(product.id) === String(entry.productId)
      );

      if (!product) {
        return null;
      }

      return {
        product,
        quantity: entry.quantity,
        lineTotal: Number(product.price || 0) * entry.quantity,
      };
    })
    .filter(Boolean);
}, [cart, products]);

const cartSubtotal = useMemo(() => {
  return cartItems.reduce((total, item) => total + item.lineTotal, 0);
}, [cartItems]);

  const {
    checkoutForm,
    accountAddresses,
    activeShippingTiers,
    shippingFee,
    checkoutTotal,
    showCheckout,
    setShowCheckout,
    checkoutError,
    setCheckoutError,
    checkoutNotice,
    setCheckoutNotice,
    isSubmittingCheckout,
    openCheckout: openCheckoutRaw,
    onFieldChange,
    handleCheckoutSubmit
  } = useCheckout({
    currentUser,
    cartItems,
    shippingTiers: settings?.shippingTiers,
    onNavigate
  });
  useEffect(() => {
  if (!Array.isArray(products) || products.length === 0) return;

  const availableProductIds = new Set(
    products
      .filter(
        (item) =>
          normalizeAvailability(item.availability) !== "out_of_stock"
      )
      .map((item) => item.id)
  );

  const nextCart = cart.filter(
    (item) =>
      availableProductIds.has(item.productId) &&
      item.quantity > 0
  );

  if (nextCart.length !== cart.length) {
    replaceCart(nextCart);
    setCartToast(
      "Some out-of-stock items were removed from your cart."
    );
    setCheckoutError(
      "Your cart was updated because some items are out of stock."
    );
  }
}, [cart, products, replaceCart, setCheckoutError]);


  useEffect(() => {
    if (location.pathname !== "/") return;

    const params = new URLSearchParams(location.search || "");
    const shouldOpenCart = params.get("openCart") === "1";
    const shouldOpenCheckout = params.get("openCheckout") === "1";
    if (!shouldOpenCart && !shouldOpenCheckout) return;

    if (shouldOpenCart) {
      setShowCart(true);
    }

    if (shouldOpenCheckout && currentUser && (cartItems ?? []).length > 0)  {
      openCheckoutRaw().then((opened) => {
        if (opened) setShowCart(false);
      });
    }

    const cleaned = new URLSearchParams(location.search || "");
    cleaned.delete("openCart");
    cleaned.delete("openCheckout");
    const nextQuery = cleaned.toString();
    onNavigate(nextQuery ? `/?${nextQuery}` : "/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, currentUser, (cartItems ?? []).length, onNavigate]);

  useEffect(() => {
    if (location.pathname !== "/" || !pendingSearchFocus) return;
    const timer = window.setTimeout(() => {
      const input = document.getElementById("catalog-search-input");
      input?.focus();
      input?.select?.();
      setPendingSearchFocus(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [location.pathname, pendingSearchFocus]);

  useEffect(() => {
    if (!cartToast) return undefined;
    const timer = window.setTimeout(() => {
      setCartToast("");
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [cartToast]);

  const addToCart = (product, quantity = 1) => {
    if (!orderingEnabled) {
      setCheckoutNotice("Ordering is disabled in admin preview mode.");
      setCheckoutError("");
      return;
    }

    const availability = normalizeAvailability(product?.availability);
    if (availability === "out_of_stock") {
      setCartToast(`${product.name} is currently out of stock.`);
      return;
    }

    addToCartRaw(product.id, quantity);
    setCartToast(
      availability === "preorder" ? `${product.name} added as preorder.` : `${product.name} added to cart.`
    );
    setCheckoutError("");
  };

  const handleBuyNowFromDetails = (product, quantity) => {
    if (!orderingEnabled) {
      setCheckoutNotice("Ordering is disabled in admin preview mode.");
      setCheckoutError("");
      setSelectedProduct(null);
      return;
    }

    addToCart(product, quantity);
    setSelectedProduct(null);
    setShowCart(true);
    if (!currentUser) {
      setCheckoutError("Please login to complete checkout.");
    }
  };

  const openCheckout = async () => {
    if (!orderingEnabled) {
      setCheckoutNotice("Ordering is disabled in admin preview mode.");
      setCheckoutError("");
      return;
    }

    if ((cartItems ?? []).length === 0) return;
    const opened = await openCheckoutRaw();
    if (opened) setShowCart(false);
  };

  const openSearch = () => {
    setSearchQuery("");
    if (location.pathname !== "/") {
      setPendingSearchFocus(true);
      onNavigate("/");
      return;
    }
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingSearchFocus(true);
  };

  const markNewsletterSubscribed = () => {
    setNewsletterSubscribedFlag();
  };

  const addToWishlist = async (product) => {
    if (!product?.id) return;
    if (!currentUser) {
      setCartToast("Please login to save frames to your wishlist.");
      onNavigate(buildLoginRedirect());
      return;
    }

    setWishlistPendingProductId(product.id);
    try {
      await addWishlistItem(product.id);
      setCartToast(`${product.name} saved to wishlist.`);
    } catch (requestError) {
      setCartToast(requestError.message || "Could not save to wishlist.");
    } finally {
      setWishlistPendingProductId("");
    }
  };

  const dismissNewsletterPopup = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NEWSLETTER_DISMISSED_UNTIL_KEY, String(Date.now() + NEWSLETTER_DISMISS_MS));
    }
    setShowNewsletterPopup(false);
  };

  const submitNewsletterEmail = async ({ emailAddress, source, setStatus, setPending, resetEmail }) => {
    if (!emailAddress.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setStatus("Enter a valid email address.");
      return false;
    }

    setPending(true);
    try {
      await createSubscription({
        email: emailAddress.trim(),
        source
      });
      markNewsletterSubscribed();
      resetEmail?.();
      setStatus("Thanks. We will keep you updated.");
      setShowNewsletterPopup(false);
      return true;
    } catch (requestError) {
      setStatus(requestError.message || "Could not subscribe right now. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    await submitNewsletterEmail({
      emailAddress: email,
      source: isAdminPreview ? "admin-storefront" : "footer",
      setStatus: setCartToast,
      setPending: setIsSubscribing,
      resetEmail: () => setEmail("")
    });
  };

  const handleNewsletterPopupSubmit = async (event) => {
    event.preventDefault();
    await submitNewsletterEmail({
      emailAddress: newsletterPopupEmail,
      source: "popup",
      setStatus: setCartToast,
      setPending: setIsPopupSubscribing,
      resetEmail: () => setNewsletterPopupEmail("")
    });
  };

  return (
    <div className="page">
      <div className="site-shell">
        <PreviewStorefront
          products={products}
          settings={settings}
          blogs={blogs}
          currentUser={currentUser}
          styleVariant={previewStyle}
          onStyleVariantChange={setPreviewStyle}
          onOpenAdmin={() => onNavigate(currentUser?.role === "admin" ? "/admin" : "/admin/login")}
          cartCount={cartCount}
          onOpenCart={orderingEnabled ? () => setShowCart(true) : undefined}
          onOpenProfile={() => onNavigate(currentUser ? "/account" : "/account/login")}
          onOpenAbout={() => setShowAboutModal(true)}
          onViewProduct={setSelectedProduct}
          onAddToCart={addToCart}
          allowOrdering={orderingEnabled}
          primaryShopTargetId="shop"
          showSupportSections={false}
        />
        <main className={`preview-flow-continuation preview-flow-${previewStyle}`}>
          <ArrivalsSection
            products={products}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onViewProduct={setSelectedProduct}
            onAddToCart={addToCart}
            onAddToWishlist={addToWishlist}
            wishlistPendingProductId={wishlistPendingProductId}
            allowOrdering={orderingEnabled}
            themeVariant={previewStyle}
          />
          <PreviewSupportSections
            blogs={blogs}
            reviewItems={settings?.reviewItems}
            faqItems={settings?.faqItems}
            onOpenAdmin={() => onNavigate(currentUser?.role === "admin" ? "/admin" : "/admin/login")}
            includeFooter={false}
          />
          <ContactSection
            email={email}
            onEmailChange={(nextEmail) => {
              setEmail(nextEmail);
            }}
            onSubscribe={handleNewsletterSubmit}
            isSubscribing={isSubscribing}
            themeVariant={previewStyle}
          />
        </main>
      </div>

      {cartToast ? (
        <p className="purchase-toast" role="status" aria-live="polite">
          {cartToast}
        </p>
      ) : null}

      {showNewsletterPopup ? (
        <div className="newsletter-popup-overlay" onClick={dismissNewsletterPopup}>
          <section
            className={`newsletter-popup newsletter-popup-${previewStyle}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsletter-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="newsletter-popup-close"
              onClick={dismissNewsletterPopup}
              aria-label="Close newsletter popup"
            >
              x
            </button>
            <p>Newsletter</p>
            <h2 id="newsletter-popup-title">
              Join the <em>drop list</em>.
            </h2>
            <span>Get early access to new frames, restocks, and member-only notes.</span>
            <form onSubmit={handleNewsletterPopupSubmit}>
              <input
                type="email"
                placeholder="your@email.com"
                value={newsletterPopupEmail}
                onChange={(event) => setNewsletterPopupEmail(event.target.value)}
                disabled={isPopupSubscribing}
                aria-label="Email address"
              />
              <button type="submit" disabled={isPopupSubscribing}>
                {isPopupSubscribing ? <span className="subscribe-button-spinner" aria-hidden="true" /> : "Join"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {showAboutModal ? (
        <div className="commerce-overlay about-modal-overlay" onClick={() => setShowAboutModal(false)}>
          <div
            className="about-modal"
            role="dialog"
            aria-modal="true"
            aria-label="About IfeShades & More"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="close-x"
              onClick={() => setShowAboutModal(false)}
              aria-label="Close about modal"
            >
              x
            </button>
            <h3>About IfeShades & More</h3>
            <p>
              IfeShades & More was created by Ifeoluwa Moreira, a paediatric nurse who believes care goes beyond
              the hospital walls. Just like I care for little ones with attention and compassion, I bring that same
              thoughtfulness to every pair of shades. Thank you for supporting this journey — where style meets
              sincerity.
            </p>
          </div>
        </div>
      ) : null}

      <ProductDetailsModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
        onAddToWishlist={addToWishlist}
        isSavingWishlist={Boolean(selectedProduct?.id && wishlistPendingProductId === selectedProduct.id)}
        onBuyNow={handleBuyNowFromDetails}
        allowOrdering={orderingEnabled}
      />

      {orderingEnabled ? (
        <>
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
            selectedShippingTierId={checkoutForm.shippingTierId}
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
        </>
      ) : null}
    </div>
  );
}

export default StorefrontPage;