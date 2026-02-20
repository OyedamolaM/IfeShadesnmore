import { useEffect, useMemo, useState } from "react";
import Header from "./components/layout/Header";
import HeroSection from "./components/sections/HeroSection";
import FeatureStrip from "./components/sections/FeatureStrip";
import ArrivalsSection from "./components/sections/ArrivalsSection";
import ContactSection from "./components/sections/ContactSection";
import AdminOverlay from "./components/admin/AdminOverlay";
import ProductDetailsModal from "./components/product/ProductDetailsModal";
import CartDrawer from "./components/cart/CartDrawer";
import CheckoutModal from "./components/cart/CheckoutModal";
import ProfileModal from "./components/profile/ProfileModal";
import {
  CART_STORAGE_KEY,
  DEFAULT_HERO_ROTATION_IMAGES,
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS,
  EMPTY_PRODUCT,
  ORDER_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  PRODUCT_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from "./constants/storefront";
import { readStoredValue } from "./utils/storage";
import { fileToDataUrl } from "./utils/files";

const PAYSTACK_SCRIPT_SRC = "https://js.paystack.co/v1/inline.js";
let paystackScriptPromise = null;

function loadPaystackScript() {
  if (window.PaystackPop?.setup) {
    return Promise.resolve();
  }

  if (paystackScriptPromise) {
    return paystackScriptPromise;
  }

  paystackScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${PAYSTACK_SCRIPT_SRC}"]`);
    if (existingScript) {
      if (window.PaystackPop?.setup) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          paystackScriptPromise = null;
          reject(new Error("Paystack failed to load."));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PAYSTACK_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      paystackScriptPromise = null;
      reject(new Error("Paystack failed to load."));
    };
    document.body.appendChild(script);
  });

  return paystackScriptPromise;
}

function generateProductId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `product-${Date.now()}`;
}

function normalizeSection(section) {
  if (section === "arrival") return "category";
  if (section === "featured") return "bestseller";
  return section;
}

function normalizeAudience(value) {
  if (value === "women" || value === "men" || value === "unisex") return value;
  return "unisex";
}

function normalizeProduct(product) {
  return {
    ...product,
    section: normalizeSection(product.section),
    audience: normalizeAudience(product.audience),
    ctaLabel: product.ctaLabel || "",
    description: product.description || ""
  };
}

function mergeProductsWithDefaults(storedProducts) {
  if (!Array.isArray(storedProducts) || storedProducts.length === 0) {
    return DEFAULT_PRODUCTS;
  }

  const defaultById = DEFAULT_PRODUCTS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  return storedProducts.map((rawItem) => {
    const item = normalizeProduct(rawItem);
    const fallback = defaultById[item.id];
    if (!fallback) return item;

    return {
      ...fallback,
      ...item,
      section: normalizeSection(item.section || fallback.section),
      audience: normalizeAudience(item.audience || fallback.audience),
      image: item.image || fallback.image,
      ctaLabel: item.ctaLabel || fallback.ctaLabel || "",
      description: item.description || fallback.description || ""
    };
  });
}

function createOrderId() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const short = Math.floor(Math.random() * 9000 + 1000);
  return `IFE-${stamp}-${short}`;
}

function normalizePaymentMethod(value) {
  return value === "transfer" ? "transfer" : "card";
}

function paymentMethodLabel(value) {
  return normalizePaymentMethod(value) === "transfer" ? "Paystack Transfer" : "Paystack Card";
}

function resolvePaystackChannels(value) {
  return normalizePaymentMethod(value) === "transfer" ? ["bank_transfer", "bank"] : ["card"];
}

const EMPTY_PROFILE = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: ""
};

async function openPaystackCheckout({
  publicKey,
  email,
  amountInKobo,
  fullName,
  phone,
  orderId,
  paymentMethod,
  itemCount
}) {
  await loadPaystackScript();

  if (!window.PaystackPop?.setup) {
    throw new Error("Paystack is not available in this browser.");
  }

  const channels = resolvePaystackChannels(paymentMethod);
  const reference = `${orderId}-${Date.now()}`;

  return new Promise((resolve) => {
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email,
      amount: amountInKobo,
      currency: "NGN",
      ref: reference,
      channels,
      metadata: {
        custom_fields: [
          {
            display_name: "Customer Name",
            variable_name: "customer_name",
            value: fullName
          },
          {
            display_name: "Phone",
            variable_name: "phone",
            value: phone
          },
          {
            display_name: "Items",
            variable_name: "item_count",
            value: String(itemCount)
          }
        ]
      },
      callback: (response) => {
        resolve({
          status: "success",
          response
        });
      },
      onClose: () => {
        resolve({
          status: "closed"
        });
      }
    });

    handler.openIframe();
  });
}

function App() {
  const [products, setProducts] = useState(() => {
    const stored = readStoredValue(PRODUCT_STORAGE_KEY, DEFAULT_PRODUCTS);
    return mergeProductsWithDefaults(stored);
  });
  const [settings, setSettings] = useState(() => {
    const stored = readStoredValue(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS);
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    return {
      ...merged,
      brandTagline: merged.brandTagline || DEFAULT_SETTINGS.brandTagline,
      heroImage: merged.heroImage || DEFAULT_SETTINGS.heroImage,
      paystackPublicKey: merged.paystackPublicKey || DEFAULT_SETTINGS.paystackPublicKey
    };
  });
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [showAdmin, setShowAdmin] = useState(false);
  const [productDraft, setProductDraft] = useState(EMPTY_PRODUCT);
  const [isEditing, setIsEditing] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState(() => {
    const stored = readStoredValue(PROFILE_STORAGE_KEY, EMPTY_PROFILE);
    return { ...EMPTY_PROFILE, ...stored };
  });
  const [profileDraft, setProfileDraft] = useState(profile);
  const [searchQuery, setSearchQuery] = useState("");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");

  const [cart, setCart] = useState(() => readStoredValue(CART_STORAGE_KEY, []));
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    paymentMethod: "card"
  });
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [purchaseNotice, setPurchaseNotice] = useState("");

  useEffect(() => {
    window.localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (showAdmin) {
      setSettingsDraft(settings);
    }
  }, [settings, showAdmin]);

  useEffect(() => {
    if (showProfile) {
      setProfileDraft(profile);
    }
  }, [profile, showProfile]);

  useEffect(() => {
    if (!purchaseNotice) return undefined;
    const timer = window.setTimeout(() => setPurchaseNotice(""), 6500);
    return () => window.clearTimeout(timer);
  }, [purchaseNotice]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === "a") {
        setShowAdmin(true);
      }

      if (event.key === "Escape") {
        if (showCheckout && !isSubmittingCheckout) {
          setShowCheckout(false);
        } else if (selectedProduct) {
          setSelectedProduct(null);
        } else if (showCart) {
          setShowCart(false);
        } else if (showProfile) {
          setShowProfile(false);
        } else if (showAdmin) {
          setShowAdmin(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAdmin, showCart, showCheckout, selectedProduct, isSubmittingCheckout, showProfile]);

  useEffect(() => {
    const openAdminFromHash = () => {
      if (window.location.hash.toLowerCase() === "#admin") {
        setShowAdmin(true);
      }
    };

    openAdminFromHash();
    window.addEventListener("hashchange", openAdminFromHash);
    return () => window.removeEventListener("hashchange", openAdminFromHash);
  }, []);

  const heroSlides = useMemo(() => {
    const uniqueSlides = [];

    const pushSlide = (src, alt, effect = "fade", position = "center", focus = "50% 16%") => {
      const value = (src || "").trim();
      if (!value) return;
      if (uniqueSlides.some((slide) => slide.src === value)) return;
      uniqueSlides.push({ src: value, alt, effect, position, focus });
    };

    pushSlide(
      settings.heroImage,
      "Model wearing Ife ShadesnMore glasses",
      "fade",
      "center",
      "50% 14%"
    );
    DEFAULT_HERO_ROTATION_IMAGES.forEach((slide) => {
      pushSlide(slide.src, slide.alt, slide.effect, slide.position, slide.focus);
    });

    return uniqueSlides;
  }, [settings.heroImage]);

  const productsById = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const cartItems = useMemo(() => {
    if (!Array.isArray(cart)) return [];
    return cart
      .map((entry) => {
        const product = productsById.get(entry.productId);
        const quantity = Number(entry.quantity) || 0;
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
    const validIds = new Set(products.map((product) => product.id));
    setCart((current) => {
      if (!Array.isArray(current)) return [];
      const next = current.filter((item) => validIds.has(item.productId) && item.quantity > 0);
      return next.length === current.length ? current : next;
    });
  }, [products]);

  const setCartQuantity = (productId, nextQuantity) => {
    setCart((current) => {
      const quantity = Math.max(0, Number(nextQuantity) || 0);
      const existing = Array.isArray(current) ? current : [];
      const index = existing.findIndex((item) => item.productId === productId);

      if (index === -1 && quantity > 0) {
        return [...existing, { productId, quantity }];
      }

      if (index === -1) return existing;

      if (quantity === 0) {
        return existing.filter((item) => item.productId !== productId);
      }

      return existing.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity } : item
      );
    });
  };

  const addToCart = (product, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);
    setCart((current) => {
      const existing = Array.isArray(current) ? current : [];
      const index = existing.findIndex((item) => item.productId === product.id);
      if (index === -1) {
        return [...existing, { productId: product.id, quantity: qty }];
      }

      return existing.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: item.quantity + qty } : item
      );
    });
    setShowCart(true);
    setCheckoutError("");
    setCheckoutNotice("Item added to cart.");
  };

  const openProductDetails = (product) => {
    setSelectedProduct(product);
  };

  const handleBuyNowFromDetails = (product, quantity) => {
    addToCart(product, quantity);
    setSelectedProduct(null);
    setShowCart(true);
    setCheckoutForm((current) => ({
      ...current,
      fullName: current.fullName || profile.fullName,
      email: current.email || profile.email,
      phone: current.phone || profile.phone,
      address: current.address || profile.address,
      city: current.city || profile.city
    }));
    setShowCheckout(true);
  };

  const openCheckout = () => {
    if (cartItems.length === 0) return;
    setCheckoutError("");
    setCheckoutNotice("");
    setCheckoutForm((current) => ({
      ...current,
      fullName: current.fullName || profile.fullName,
      email: current.email || profile.email,
      phone: current.phone || profile.phone,
      address: current.address || profile.address,
      city: current.city || profile.city
    }));
    setShowCheckout(true);
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    const requiredFields = ["fullName", "email", "phone", "address", "city"];
    const missingField = requiredFields.find((field) => !String(checkoutForm[field] || "").trim());

    if (cartItems.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    if (missingField) {
      setCheckoutError("Please complete all checkout fields.");
      return;
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutForm.email);
    if (!emailIsValid) {
      setCheckoutError("Please enter a valid email address.");
      return;
    }

    const paystackPublicKey = (
      settings.paystackPublicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ""
    ).trim();
    if (!paystackPublicKey) {
      setCheckoutError(
        "Paystack key is missing. Add your public key in Admin -> Brand Settings (or VITE_PAYSTACK_PUBLIC_KEY)."
      );
      return;
    }

    const amountInKobo = Math.round(cartSubtotal * 100);
    if (amountInKobo <= 0) {
      setCheckoutError("Total amount must be above zero.");
      return;
    }

    const orderId = createOrderId();
    setIsSubmittingCheckout(true);
    setCheckoutError("");
    setCheckoutNotice(`Opening ${paymentMethodLabel(checkoutForm.paymentMethod)}...`);

    try {
      const paymentResult = await openPaystackCheckout({
        publicKey: paystackPublicKey,
        email: checkoutForm.email.trim(),
        amountInKobo,
        fullName: checkoutForm.fullName.trim(),
        phone: checkoutForm.phone.trim(),
        orderId,
        paymentMethod: checkoutForm.paymentMethod,
        itemCount: cartItems.reduce((total, item) => total + item.quantity, 0)
      });

      if (paymentResult.status !== "success") {
        setCheckoutNotice("");
        setCheckoutError("Payment window closed before completion.");
        return;
      }

      const newOrder = {
        id: orderId,
        createdAt: new Date().toISOString(),
        customer: { ...checkoutForm, paymentMethod: normalizePaymentMethod(checkoutForm.paymentMethod) },
        items: cartItems.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          unitPrice: item.product.price,
          quantity: item.quantity
        })),
        total: cartSubtotal,
        status: "paid",
        payment: {
          provider: "paystack",
          method: normalizePaymentMethod(checkoutForm.paymentMethod),
          reference: paymentResult.response?.reference || null,
          transaction: paymentResult.response?.transaction || null,
          channel: paymentResult.response?.channel || null
        }
      };

      const existingOrders = readStoredValue(ORDER_STORAGE_KEY, []);
      const safeOrders = Array.isArray(existingOrders) ? existingOrders : [];
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify([newOrder, ...safeOrders]));

      setProfile({
        fullName: checkoutForm.fullName.trim(),
        email: checkoutForm.email.trim(),
        phone: checkoutForm.phone.trim(),
        address: checkoutForm.address.trim(),
        city: checkoutForm.city.trim()
      });

      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCheckoutError("");
      setCheckoutNotice("");
      setCheckoutForm({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        paymentMethod: "card"
      });
      setPurchaseNotice(
        `Payment successful. Order ${orderId} confirmed with reference ${
          paymentResult.response?.reference || "N/A"
        }.`
      );
    } catch (error) {
      setCheckoutNotice("");
      setCheckoutError(error?.message || "Could not open Paystack checkout.");
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const startEdit = (product) => {
    setIsEditing(true);
    setProductDraft({
      ...product,
      section: normalizeSection(product.section),
      audience: normalizeAudience(product.audience),
      ctaLabel: product.ctaLabel || "",
      description: product.description || "",
      price: String(product.price)
    });
    setAdminMessage("");
  };

  const resetProductForm = () => {
    setProductDraft(EMPTY_PRODUCT);
    setIsEditing(false);
  };

  const handleProductSubmit = (event) => {
    event.preventDefault();
    if (!productDraft.name.trim()) {
      setAdminMessage("Product name is required.");
      return;
    }

    const requiresPrice = normalizeSection(productDraft.section) === "bestseller";
    const trimmedPrice = String(productDraft.price).trim();

    if (requiresPrice && !trimmedPrice) {
      setAdminMessage("Price is required for best sellers.");
      return;
    }

    const parsedPrice = trimmedPrice ? Number(trimmedPrice) : 0;
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setAdminMessage("Price must be a valid number.");
      return;
    }

    const normalized = {
      ...productDraft,
      id: isEditing && productDraft.id ? productDraft.id : generateProductId(),
      name: productDraft.name.trim(),
      price: parsedPrice,
      section: normalizeSection(productDraft.section),
      audience: normalizeAudience(productDraft.audience),
      ctaLabel: (productDraft.ctaLabel || "").trim(),
      description: (productDraft.description || "").trim(),
      image: (productDraft.image || "").trim()
    };

    setProducts((current) => {
      if (isEditing) {
        return current.map((item) => (item.id === normalized.id ? normalized : item));
      }
      return [normalized, ...current];
    });

    setAdminMessage(isEditing ? "Product updated." : "Product created.");
    resetProductForm();
  };

  const removeProduct = (id) => {
    setProducts((current) => current.filter((item) => item.id !== id));
    if (productDraft.id === id) {
      resetProductForm();
    }
    setAdminMessage("Product removed.");
  };

  const handleProductUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setProductDraft((current) => ({ ...current, image: dataUrl }));
      setAdminMessage("Image uploaded.");
    } catch {
      setAdminMessage("Could not read selected image.");
    }
  };

  const handleHeroUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setSettingsDraft((current) => ({ ...current, heroImage: dataUrl }));
      setAdminMessage("Hero image uploaded.");
    } catch {
      setAdminMessage("Could not read selected hero image.");
    }
  };

  const saveSettings = (event) => {
    event.preventDefault();
    setSettings({
      brandName: settingsDraft.brandName.trim() || DEFAULT_SETTINGS.brandName,
      brandTagline: settingsDraft.brandTagline.trim() || DEFAULT_SETTINGS.brandTagline,
      heroTitle: settingsDraft.heroTitle.trim() || DEFAULT_SETTINGS.heroTitle,
      heroSubtitle: settingsDraft.heroSubtitle.trim() || DEFAULT_SETTINGS.heroSubtitle,
      heroButtonLabel: settingsDraft.heroButtonLabel.trim() || DEFAULT_SETTINGS.heroButtonLabel,
      heroImage: settingsDraft.heroImage.trim(),
      paystackPublicKey: settingsDraft.paystackPublicKey.trim()
    });
    setAdminMessage("Storefront settings saved.");
  };

  const handleSubscribe = (event) => {
    event.preventDefault();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailStatus("Enter a valid email address.");
      return;
    }
    setEmail("");
    setEmailStatus("Thanks. We will keep you updated.");
  };

  const handleSettingsDraftChange = (field, value) => {
    setSettingsDraft((current) => ({ ...current, [field]: value }));
  };

  const handleProductDraftChange = (field, value) => {
    setProductDraft((current) => ({ ...current, [field]: value }));
  };

  const handleProfileDraftChange = (field, value) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  };

  const openProfile = () => {
    setProfileDraft(profile);
    setShowProfile(true);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    setProfile({
      fullName: profileDraft.fullName.trim(),
      email: profileDraft.email.trim(),
      phone: profileDraft.phone.trim(),
      address: profileDraft.address.trim(),
      city: profileDraft.city.trim()
    });
    setShowProfile(false);
  };

  const openSearch = () => {
    setSearchQuery("");
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const input = document.getElementById("catalog-search-input");
      input?.focus();
      input?.select?.();
    }, 450);
  };

  const openAdmin = () => {
    setShowAdmin(true);
  };

  const closeAdmin = () => {
    setShowAdmin(false);
    if (window.location.hash.toLowerCase() === "#admin") {
      const nextUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", nextUrl);
    }
  };

  return (
    <>
      <div className="page">
        <div className="site-shell">
          <Header
            brandName={settings.brandName}
            brandTagline={settings.brandTagline}
            onOpenAdmin={openAdmin}
            cartCount={cartCount}
            onOpenCart={() => setShowCart(true)}
            onOpenProfile={openProfile}
            onOpenSearch={openSearch}
          />
          <main>
            <HeroSection settings={settings} heroSlides={heroSlides} />
            <ArrivalsSection
              products={products}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onViewProduct={openProductDetails}
              onAddToCart={addToCart}
            />
            <FeatureStrip />
            <ContactSection
              email={email}
              emailStatus={emailStatus}
              onEmailChange={(nextEmail) => {
                setEmail(nextEmail);
                setEmailStatus("");
              }}
              onSubscribe={handleSubscribe}
            />
          </main>
        </div>
      </div>

      {purchaseNotice ? <p className="purchase-toast">{purchaseNotice}</p> : null}

      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        profileDraft={profileDraft}
        onFieldChange={handleProfileDraftChange}
        onSave={saveProfile}
      />

      <ProductDetailsModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
        onBuyNow={handleBuyNowFromDetails}
      />

      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        items={cartItems}
        subtotal={cartSubtotal}
        onDecrement={(id) => {
          const current = cartItems.find((item) => item.product.id === id);
          setCartQuantity(id, (current?.quantity || 1) - 1);
        }}
        onIncrement={(id) => {
          const current = cartItems.find((item) => item.product.id === id);
          setCartQuantity(id, (current?.quantity || 0) + 1);
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

      {showAdmin ? (
        <AdminOverlay
          settingsDraft={settingsDraft}
          onSettingsDraftChange={handleSettingsDraftChange}
          onSaveSettings={saveSettings}
          onHeroUpload={handleHeroUpload}
          productDraft={productDraft}
          onProductDraftChange={handleProductDraftChange}
          onProductSubmit={handleProductSubmit}
          onProductUpload={handleProductUpload}
          isEditing={isEditing}
          onCancelEdit={resetProductForm}
          products={products}
          onStartEdit={startEdit}
          onRemoveProduct={removeProduct}
          adminMessage={adminMessage}
          onClose={closeAdmin}
        />
      ) : null}
    </>
  );
}

export default App;
