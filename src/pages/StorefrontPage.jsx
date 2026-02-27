import { useEffect, useMemo, useState } from "react";
import Header from "../components/layout/Header";
import HeroSection from "../components/sections/HeroSection";
import ArrivalsSection from "../components/sections/ArrivalsSection";
import FeatureStrip from "../components/sections/FeatureStrip";
import ContactSection from "../components/sections/ContactSection";
import ProductDetailsModal from "../components/product/ProductDetailsModal";
import CartDrawer from "../components/cart/CartDrawer";
import CheckoutModal from "../components/cart/CheckoutModal";
import { CART_STORAGE_KEY } from "../constants/storefront";
import { createSubscription, initializeCheckout } from "../utils/api";

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
    paymentMethod: "card"
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

function StorefrontPage({
  products,
  settings,
  heroSlides,
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

  const [searchQuery, setSearchQuery] = useState("");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [pendingSearchFocus, setPendingSearchFocus] = useState(false);
  const [cartToast, setCartToast] = useState("");
  const [showAboutModal, setShowAboutModal] = useState(false);

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

  const openCheckout = () => {
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
    const nameParts = splitFullName(currentUser.fullName || "");
    setCheckoutForm((current) => ({
      ...current,
      firstName: current.firstName || nameParts.firstName,
      lastName: current.lastName || nameParts.lastName,
      email: current.email || currentUser.email || "",
      phone: current.phone || currentUser.phone || "",
      address: current.address || currentUser.address || "",
      city: current.city || currentUser.city || ""
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

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailStatus("Enter a valid email address.");
      return;
    }

    setIsSubscribing(true);
    try {
      await createSubscription({
        email: email.trim(),
        source: isAdminPreview ? "admin-storefront" : "footer"
      });
      setEmail("");
      setEmailStatus("Thanks. We will keep you updated.");
    } catch (requestError) {
      setEmailStatus(requestError.message || "Could not subscribe right now. Try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="page">
      <div className="site-shell">
        {isAdminPreview ? (
          <div className="admin-preview-banner">
            <div className="container admin-preview-banner-inner">
              <p>You are viewing storefront in admin preview mode. Ordering is disabled.</p>
              <button type="button" className="secondary-action" onClick={() => onNavigate("/admin")}>
                Back to Admin
              </button>
            </div>
          </div>
        ) : null}
        <Header
          brandName={settings.brandName}
          brandTagline={settings.brandTagline}
          onOpenAdmin={() => onNavigate(currentUser?.role === "admin" ? "/admin" : "/admin/login")}
          cartCount={cartCount}
          onOpenCart={orderingEnabled ? () => setShowCart(true) : undefined}
          onOpenProfile={() =>
            onNavigate(currentUser ? (currentUser.role === "admin" ? "/admin" : "/account") : "/account/login")
          }
          onOpenSearch={openSearch}
          onOpenAbout={() => setShowAboutModal(true)}
          showCart={orderingEnabled}
        />
        <main>
          <HeroSection settings={settings} heroSlides={heroSlides} />
          <ArrivalsSection
            products={products}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onViewProduct={setSelectedProduct}
            onAddToCart={addToCart}
            allowOrdering={orderingEnabled}
          />
          <FeatureStrip items={settings.featureItems} />
          <ContactSection
            email={email}
            emailStatus={emailStatus}
            onEmailChange={(nextEmail) => {
              setEmail(nextEmail);
              setEmailStatus("");
            }}
            onSubscribe={handleNewsletterSubmit}
            isSubscribing={isSubscribing}
          />
        </main>
      </div>

      {cartToast ? (
        <p className="purchase-toast" role="status" aria-live="polite">
          {cartToast}
        </p>
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
            form={checkoutForm}
            onFieldChange={(field, value) => {
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
