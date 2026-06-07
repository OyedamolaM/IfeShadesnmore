import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import AdminOverlay from "./components/admin/AdminOverlay";
import {
  DEFAULT_HERO_ROTATION_IMAGES,
  DEFAULT_PRODUCT_DETAIL_BULLETS,
  DEFAULT_SETTINGS,
  EMPTY_PRODUCT
} from "./constants/storefront";
import {
  createProduct,
  deleteProduct,
  fetchMe,
  fetchStorefront,
  logout,
  uploadImage,
  updateProduct,
  updateSettings
} from "./utils/api";
import {
  buildHeroSlides,
  normalizeAudienceList,
  normalizeProduct,
  normalizeSection
} from "./utils/storefrontModel";
import { initAnalytics, trackPageView } from "./utils/analytics";
import StorefrontPage from "./pages/StorefrontPage";
import AccountLoginPage from "./pages/AccountLoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AccountPage from "./pages/AccountPage";
import PaymentCallbackPage from "./pages/PaymentCallbackPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

function LoadingView() {
  return (
    <div className="page">
      <div className="site-shell loading-shell">
        <p>Loading storefront...</p>
      </div>
    </div>
  );
}

function ErrorView({ message, onRetry }) {
  return (
    <div className="page">
      <div className="site-shell loading-shell">
        <p>{message}</p>
        <button type="button" className="primary-action" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

function normalizeDetailBulletLines(value) {
  const source = String(value || "");
  const normalized = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  return normalized.length > 0 ? normalized : DEFAULT_PRODUCT_DETAIL_BULLETS;
}

function formatDetailBulletLines(value) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const resolved = normalized.length > 0 ? normalized : DEFAULT_PRODUCT_DETAIL_BULLETS;
  return resolved.join("\n");
}

function shouldLoadStorefront(screen) {
  return ["home", "admin", "admin-preview"].includes(screen);
}

function App({ screen = "home", initialStorefront = null, initialUser = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const needsStorefront = shouldLoadStorefront(screen);

  const [isLoading, setIsLoading] = useState(() => needsStorefront && !initialStorefront);
  const [loadError, setLoadError] = useState("");
  const [products, setProducts] = useState(() =>
    Array.isArray(initialStorefront?.products)
      ? initialStorefront.products.map(normalizeProduct)
      : []
  );
  const [settings, setSettings] = useState(() =>
    initialStorefront?.settings ? { ...DEFAULT_SETTINGS, ...initialStorefront.settings } : DEFAULT_SETTINGS
  );
  const [currentUser, setCurrentUser] = useState(initialUser || null);
  const [blogs, setBlogs] = useState(() =>
    Array.isArray(initialStorefront?.blogs) ? initialStorefront.blogs : []
  );

  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [productDraft, setProductDraft] = useState(EMPTY_PRODUCT);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [isAdminStorefrontOpen, setIsAdminStorefrontOpen] = useState(false);

  const heroSlides = useMemo(
    () => buildHeroSlides(settings.heroImage, DEFAULT_HERO_ROTATION_IMAGES),
    [settings.heroImage]
  );

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const path = `${location.pathname || "/"}${location.searchStr || ""}${location.hash || ""}`;
    trackPageView(path);
  }, [location.pathname, location.searchStr, location.hash]);

  const navigateTo = useCallback((target, options = {}) => {
    const value = String(target || "/");
    const [pathAndSearch, hashPart = ""] = value.split("#");
    const [pathname, searchPart = ""] = pathAndSearch.split("?");
    navigate({
      to: pathname || "/",
      search: searchPart ? Object.fromEntries(new URLSearchParams(searchPart)) : undefined,
      hash: hashPart || undefined,
      replace: Boolean(options.replace)
    });
  }, [navigate]);

  const loadStore = async () => {
    setIsLoading(true);
    setLoadError("");
    const [storefrontResult, meResult] = await Promise.allSettled([fetchStorefront(), fetchMe()]);

    if (storefrontResult.status === "fulfilled") {
      const storefrontPayload = storefrontResult.value;
      const nextSettings = storefrontPayload?.settings
        ? { ...DEFAULT_SETTINGS, ...storefrontPayload.settings }
        : DEFAULT_SETTINGS;
      const nextProducts = Array.isArray(storefrontPayload?.products)
        ? storefrontPayload.products.map(normalizeProduct)
        : [];
      const nextBlogs = Array.isArray(storefrontPayload?.blogs) ? storefrontPayload.blogs : [];
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
      setProducts(nextProducts);
      setBlogs(nextBlogs);
    } else {
      setLoadError(storefrontResult.reason?.message || "Could not load storefront.");
    }

    if (meResult.status === "fulfilled") {
      const mePayload = meResult.value;
      setCurrentUser(mePayload?.user || null);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (!needsStorefront || initialStorefront) return;
    loadStore();
  }, [initialStorefront, needsStorefront]);

  useEffect(() => {
    if (screen !== "admin") {
      setIsAdminStorefrontOpen(false);
    }
  }, [screen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === "a") {
        navigateTo(currentUser?.role === "admin" ? "/admin" : "/admin/login");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentUser, navigateTo]);

  const startEdit = (product) => {
    setIsEditingProduct(true);
    const audiences = normalizeAudienceList(product.audiences || product.audience);
    const detailBullets = Array.isArray(product.detailBullets)
      ? product.detailBullets
      : DEFAULT_PRODUCT_DETAIL_BULLETS;
    setProductDraft({
      ...product,
      section: normalizeSection(product.section),
      audience: audiences[0],
      audiences,
      availability: String(product.availability || "in_stock"),
      preorderNote: String(product.preorderNote || ""),
      ctaLabel: product.ctaLabel || "",
      description: product.description || "",
      detailBullets,
      detailBulletsText: formatDetailBulletLines(detailBullets),
      price: String(product.price)
    });
    setAdminMessage("");
  };

  const resetProductDraft = () => {
    setProductDraft(EMPTY_PRODUCT);
    setIsEditingProduct(false);
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setAdminMessage("");
    try {
      const audiences = normalizeAudienceList(productDraft.audiences || productDraft.audience);
      const detailBullets = normalizeDetailBulletLines(productDraft.detailBulletsText);
      const payload = {
        id: isEditingProduct ? productDraft.id : undefined,
        name: productDraft.name.trim(),
        price: Number(productDraft.price) || 0,
        section: normalizeSection(productDraft.section),
        audience: audiences[0],
        audiences,
        availability: String(productDraft.availability || "in_stock"),
        preorderNote:
          String(productDraft.availability || "in_stock") === "preorder"
            ? String(productDraft.preorderNote || "").trim()
            : "",
        ctaLabel: String(productDraft.ctaLabel || "").trim(),
        description: String(productDraft.description || "").trim(),
        detailBullets,
        variant: String(productDraft.variant || "round").trim() || "round",
        image: String(productDraft.image || "").trim()
      };
      if (!payload.name) throw new Error("Product name is required.");
      const response = isEditingProduct
        ? await updateProduct(productDraft.id, payload)
        : await createProduct(payload);
      const nextProduct = normalizeProduct(response.product);
      setProducts((current) =>
        isEditingProduct
          ? current.map((item) => (item.id === nextProduct.id ? nextProduct : item))
          : [nextProduct, ...current]
      );
      setAdminMessage(isEditingProduct ? "Product updated." : "Product added.");
      resetProductDraft();
    } catch (requestError) {
      setAdminMessage(requestError.message || "Could not save product.");
    }
  };

  const handleProductRemove = async (productId) => {
    try {
      await deleteProduct(productId);
      setProducts((current) => current.filter((item) => item.id !== productId));
      setAdminMessage("Product deleted.");
      if (productDraft.id === productId) resetProductDraft();
    } catch (requestError) {
      setAdminMessage(requestError.message || "Could not delete product.");
    }
  };

  const handleSettingsSave = async (event) => {
    event.preventDefault();
    try {
      const payload = await updateSettings({
        brandName: settingsDraft.brandName.trim() || DEFAULT_SETTINGS.brandName,
        brandTagline: settingsDraft.brandTagline.trim() || DEFAULT_SETTINGS.brandTagline,
        heroKicker: String(settingsDraft.heroKicker || "").trim(),
        heroTitle: settingsDraft.heroTitle.trim() || DEFAULT_SETTINGS.heroTitle,
        heroSubtitle: settingsDraft.heroSubtitle.trim() || DEFAULT_SETTINGS.heroSubtitle,
        heroButtonLabel: settingsDraft.heroButtonLabel.trim() || DEFAULT_SETTINGS.heroButtonLabel,
        heroImage: settingsDraft.heroImage.trim(),
        heroPromiseItems: Array.isArray(settingsDraft.heroPromiseItems)
          ? settingsDraft.heroPromiseItems
          : DEFAULT_SETTINGS.heroPromiseItems,
        featureItems: Array.isArray(settingsDraft.featureItems)
          ? settingsDraft.featureItems
          : DEFAULT_SETTINGS.featureItems,
        shippingTiers: Array.isArray(settingsDraft.shippingTiers)
          ? settingsDraft.shippingTiers
          : []
      });
      setSettings(payload.settings);
      setSettingsDraft(payload.settings);
      setAdminMessage("Store settings updated.");
    } catch (requestError) {
      setAdminMessage(requestError.message || "Could not save settings.");
    }
  };

  const handleProductUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setAdminMessage("Uploading product image...");
      const uploaded = await uploadImage(file, "product");
      setProductDraft((current) => ({ ...current, image: uploaded.secureUrl }));
      setAdminMessage("Product image uploaded.");
    } catch (error) {
      setAdminMessage(error.message || "Could not upload selected product image.");
    } finally {
      event.target.value = "";
    }
  };

  const handleHeroUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setAdminMessage("Uploading hero image...");
      const uploaded = await uploadImage(file, "hero");
      setSettingsDraft((current) => ({ ...current, heroImage: uploaded.secureUrl }));
      setAdminMessage("Hero image uploaded.");
    } catch (error) {
      setAdminMessage(error.message || "Could not upload selected hero image.");
    }
  };

  const handleAdminLogout = async () => {
    await logout().catch(() => {});
    setCurrentUser(null);
    navigateTo("/admin/login", { replace: true });
  };

  const routeLocation = {
    pathname: location.pathname || "/",
    search: location.searchStr || "",
    hash: location.hash || ""
  };

  const redirectTarget = (() => {
    if (screen === "admin-preview" && currentUser?.role !== "admin") return "/admin/login";
    if (screen === "account" && !currentUser) return "/account/login";
    if (screen === "admin" && currentUser?.role !== "admin") return "/admin/login";
    return "";
  })();

  useEffect(() => {
    if (!redirectTarget) return;
    navigateTo(redirectTarget, { replace: true });
  }, [navigateTo, redirectTarget]);

  if (redirectTarget) {
    return <LoadingView />;
  }

  if (needsStorefront && isLoading) {
    return <LoadingView />;
  }

  if (needsStorefront && loadError) {
    return <ErrorView message={loadError} onRetry={loadStore} />;
  }

  if (screen === "admin" && isAdminStorefrontOpen) {
    const handleAdminPreviewNavigate = (target, options = {}) => {
      if (String(target || "") === "/admin") {
        setIsAdminStorefrontOpen(false);
        return;
      }
      navigateTo(target, options);
    };

    return (
      <StorefrontPage
        products={products}
        settings={settings}
        heroSlides={heroSlides}
        blogs={blogs}
        currentUser={currentUser}
        location={{ ...routeLocation, pathname: "/admin/storefront" }}
        onNavigate={handleAdminPreviewNavigate}
        orderingEnabled={false}
        isAdminPreview
      />
    );
  }

  if (screen === "home" || screen === "admin-preview") {
    return (
      <StorefrontPage
        products={products}
        settings={settings}
        heroSlides={heroSlides}
        blogs={blogs}
        currentUser={currentUser}
        location={routeLocation}
        onNavigate={navigateTo}
        orderingEnabled={screen === "home" && currentUser?.role !== "admin"}
        isAdminPreview={screen === "admin-preview"}
      />
    );
  }

  if (screen === "account-login") {
    return <AccountLoginPage currentUser={currentUser} onAuthenticated={setCurrentUser} />;
  }

  if (screen === "verify-email") {
    return <VerifyEmailPage onVerified={setCurrentUser} />;
  }

  if (screen === "account") {
    return (
      <AccountPage
        currentUser={currentUser}
        onLoggedOut={() => setCurrentUser(null)}
        onUserUpdated={setCurrentUser}
      />
    );
  }

  if (screen === "admin-login") {
    return <AdminLoginPage currentUser={currentUser} onAuthenticated={setCurrentUser} />;
  }

  if (screen === "admin") {
    return (
      <AdminOverlay
        currentUser={currentUser}
        settingsDraft={settingsDraft}
        onSettingsDraftChange={(field, value) =>
          setSettingsDraft((current) => ({ ...current, [field]: value }))
        }
        onSaveSettings={handleSettingsSave}
        onHeroUpload={handleHeroUpload}
        productDraft={productDraft}
        onProductDraftChange={(field, value) =>
          setProductDraft((current) => ({ ...current, [field]: value }))
        }
        onProductSubmit={handleProductSubmit}
        onProductUpload={handleProductUpload}
        isEditing={isEditingProduct}
        onCancelEdit={resetProductDraft}
        products={products}
        onStartEdit={startEdit}
        onRemoveProduct={handleProductRemove}
        onBlogsChange={setBlogs}
        adminMessage={adminMessage}
        onOpenStorefront={() => {
          setIsAdminStorefrontOpen(true);
          window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
        }}
        onLogout={handleAdminLogout}
      />
    );
  }

  if (screen === "payment-callback") {
    return <PaymentCallbackPage />;
  }

  return <StorefrontPage products={products} settings={settings} heroSlides={heroSlides} blogs={blogs} currentUser={currentUser} location={routeLocation} onNavigate={navigateTo} />;
}

export default App;
