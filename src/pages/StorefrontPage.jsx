import { useEffect, useMemo, useState } from "react";
import ArrivalsSection from "../components/sections/ArrivalsSection";
import ContactSection from "../components/sections/ContactSection";
import ProductDetailsModal from "../components/product/ProductDetailsModal";
import CartDrawer from "../components/cart/CartDrawer";
import CheckoutModal from "../components/cart/CheckoutModal";
import PreviewStorefront, { PreviewSupportSections } from "./PreviewStorefront";
import { CART_STORAGE_KEY } from "../constants/storefront";
import { addWishlistItem, createSubscription, fetchAccountDashboard, initializeCheckout } from "../utils/api";
import { getStoredThemeVariant, persistThemeVariant } from "../utils/themePreference";

const NEWSLETTER_DISMISS_MS = 24 * 60 * 60 * 1000;
const NEWSLETTER_POPUP_DELAY_MS = 90 * 1000;
const NEWSLETTER_DISMISSED_UNTIL_KEY = "ife_newsletter_dismissed_until";
const NEWSLETTER_SUBSCRIBED_KEY = "ife_newsletter_subscribed";

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "in_stock" || source === "out_of_stock" || source === "preorder") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function splitFullName(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function createCheckoutForm(user) {
  const nameParts = splitFullName(user?.fullName);
  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    addressId: "",
    paymentMethod: "card",
    shippingTierId: ""
  };
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

function buildCheckoutLoginRedirect() {
  const params = new URLSearchParams({
    openCart: "1",
    openCheckout: "1"
  });
  return `/account/login?redirect=${encodeURIComponent(`/?${params.toString()}`)}`;
}

function buildLoginRedirect() {
  return `/account/login?redirect=${encodeURIComponent("/")}`;
}

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
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return [];
    return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState(createCheckoutForm(currentUser));
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [accountAddresses, setAccountAddresses] = useState([]);

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
    const nameParts = splitFullName(currentUser?.fullName || "");
    setCheckoutForm((current) => ({
      ...current,
      firstName: current.firstName || nameParts.firstName,
      lastName: current.lastName || nameParts.lastName,
      email: current.email || currentUser?.email || "",
      phone: current.phone || currentUser?.phone || "",
      address: current.address || currentUser?.address || "",
      city: current.city || currentUser?.city || ""
    }));
  }, [currentUser]);

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

  const cartItems = useMemo(() => {
    return cart
      .map((entry) => {
        const product = productsById.get(entry.productId);
        const quantity = Math.max(0, Number(entry.quantity) || 0);
        if (!product || quantity <= 0) return null;
        return {
          product,
          quantity,
          lineTotal: product.price * quantity
        };
      })
      .filter(Boolean);
  }, [cart, productsById]);

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.lineTotal, 0),
    [cartItems]
  );
  const activeShippingTiers = useMemo(
    () => (Array.isArray(settings?.shippingTiers) ? settings.shippingTiers : []).filter((tier) => tier?.isActive !== false),
    [settings?.shippingTiers]
  );
  const selectedShippingTier = useMemo(
    () => activeShippingTiers.find((tier) => tier.id === checkoutForm.shippingTierId) || activeShippingTiers[0] || null,
    [activeShippingTiers, checkoutForm.shippingTierId]
  );
  const shippingFee = Number(selectedShippingTier?.fee) || 0;
  const checkoutTotal = cartSubtotal + shippingFee;

  useEffect(() => {
    if (!showCheckout || activeShippingTiers.length === 0) return;
    if (checkoutForm.shippingTierId && activeShippingTiers.some((tier) => tier.id === checkoutForm.shippingTierId)) return;
    setCheckoutForm((current) => ({ ...current, shippingTierId: activeShippingTiers[0].id }));
  }, [activeShippingTiers, checkoutForm.shippingTierId, showCheckout]);

  useEffect(() => {
    const availableProductIds = new Set(
      products
        .filter((item) => normalizeAvailability(item.availability) !== "out_of_stock")
        .map((item) => item.id)
    );
    const nextCart = cart.filter((item) => availableProductIds.has(item.productId) && item.quantity > 0);
    if (nextCart.length !== cart.length) {
      setCart(nextCart);
      setCartToast("Some out-of-stock items were removed from your cart.");
      setCheckoutError("Your cart was updated because some items are out of stock.");
    }
  }, [cart, products]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (location.pathname !== "/") return;

    const params = new URLSearchParams(location.search || "");
    const shouldOpenCart = params.get("openCart") === "1";
    const shouldOpenCheckout = params.get("openCheckout") === "1";
    if (!shouldOpenCart && !shouldOpenCheckout) return;

    if (shouldOpenCart) {
      setShowCart(true);
    }

    if (shouldOpenCheckout && currentUser && cartItems.length > 0) {
      setCheckoutError("");
      setCheckoutNotice("");
      setShowCheckout(true);
    }

    const cleaned = new URLSearchParams(location.search || "");
    cleaned.delete("openCart");
    cleaned.delete("openCheckout");
    const nextQuery = cleaned.toString();
    onNavigate(nextQuery ? `/?${nextQuery}` : "/", { replace: true });
  }, [location.pathname, location.search, currentUser, cartItems.length, onNavigate]);

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

  const setCartQuantity = (productId, nextQuantity) => {
    setCart((current) => {
      const quantity = Math.max(0, Number(nextQuantity) || 0);
      const index = current.findIndex((entry) => entry.productId === productId);
      if (index === -1 && quantity > 0) return [...current, { productId, quantity }];
      if (index === -1) return current;
      if (quantity <= 0) return current.filter((entry) => entry.productId !== productId);
      return current.map((entry, idx) => (idx === index ? { ...entry, quantity } : entry));
    });
  };

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

    const qty = Math.max(1, Number(quantity) || 1);
    setCart((current) => {
      const index = current.findIndex((entry) => entry.productId === product.id);
      if (index === -1) return [...current, { productId: product.id, quantity: qty }];
      return current.map((entry, idx) =>
        idx === index ? { ...entry, quantity: entry.quantity + qty } : entry
      );
    });
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

    if (cartItems.length === 0) return;
    if (!currentUser) {
      setCheckoutError("Please login first to complete checkout.");
      onNavigate(buildCheckoutLoginRedirect());
      return;
    }

    setCheckoutError("");
    setCheckoutNotice("");
    let savedAddresses = accountAddresses;
    try {
      const accountPayload = await fetchAccountDashboard();
      savedAddresses = Array.isArray(accountPayload.addresses) ? accountPayload.addresses : [];
      setAccountAddresses(savedAddresses);
    } catch {
      savedAddresses = accountAddresses;
    }
    const defaultAddress = savedAddresses.find((address) => address.isDefault) || savedAddresses[0] || null;
    const nameParts = splitFullName(currentUser.fullName || "");
    setCheckoutForm((current) => ({
      ...current,
      firstName: current.firstName || nameParts.firstName,
      lastName: current.lastName || nameParts.lastName,
      email: current.email || currentUser.email || "",
      phone: current.phone || defaultAddress?.phone || currentUser.phone || "",
      address: current.address || defaultAddress?.street || currentUser.address || "",
      city: current.city || defaultAddress?.city || currentUser.city || "",
      addressId: current.addressId || (defaultAddress?.id ? String(defaultAddress.id) : "")
    }));
    setShowCheckout(true);
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setCheckoutError("Please login first.");
      onNavigate(buildCheckoutLoginRedirect());
      return;
    }

    if (cartItems.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    const required = ["firstName", "lastName", "address", "city"];
    const missing = required.find((field) => !String(checkoutForm[field] || "").trim());
    if (missing) {
      setCheckoutError("Please complete all checkout fields.");
      return;
    }
    if (!String(checkoutForm.phone || "").trim() && !String(checkoutForm.email || "").trim()) {
      setCheckoutError("Phone or email is required.");
      return;
    }
    if (!selectedShippingTier) {
      setCheckoutError("Please select a shipping option.");
      return;
    }

    setCheckoutError("");
    setCheckoutNotice("Redirecting to secure payment...");
    setIsSubmittingCheckout(true);

    try {
      const payload = await initializeCheckout({
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity
        })),
        paymentMethod: checkoutForm.paymentMethod,
        shippingTierId: selectedShippingTier.id,
        addressId: checkoutForm.addressId || undefined,
        customer: {
          firstName: checkoutForm.firstName.trim(),
          lastName: checkoutForm.lastName.trim(),
          fullName: `${checkoutForm.firstName || ""} ${checkoutForm.lastName || ""}`.trim(),
          email: checkoutForm.email.trim(),
          phone: checkoutForm.phone.trim(),
          address: checkoutForm.address.trim(),
          city: checkoutForm.city.trim()
        }
      });

      window.location.href = payload.authorizationUrl;
    } catch (requestError) {
      setCheckoutError(requestError.message || "Could not initialize payment.");
      setCheckoutNotice("");
      setIsSubmittingCheckout(false);
    }
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
            selectedShippingTierId={selectedShippingTier?.id || ""}
            shippingFee={shippingFee}
            total={checkoutTotal}
            form={checkoutForm}
            savedAddresses={accountAddresses}
            onFieldChange={(field, value) => {
              if (field === "addressId") {
                const selectedAddress = accountAddresses.find((address) => String(address.id) === String(value));
                setCheckoutForm((current) => ({
                  ...current,
                  addressId: value,
                  ...(selectedAddress ? {
                    phone: selectedAddress.phone || current.phone,
                    address: selectedAddress.street || current.address,
                    city: selectedAddress.city || current.city
                  } : {})
                }));
                setCheckoutError("");
                return;
              }
              setCheckoutForm((current) => ({ ...current, [field]: value }));
              setCheckoutError("");
            }}
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
