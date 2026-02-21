import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminOverlay from "./components/admin/AdminOverlay";
import { DEFAULT_HERO_ROTATION_IMAGES, DEFAULT_SETTINGS, EMPTY_PRODUCT } from "./constants/storefront";
import { fileToDataUrl } from "./utils/files";
import {
  createProduct,
  deleteProduct,
  fetchMe,
  fetchStorefront,
  logout,
  updateProduct,
  updateSettings
} from "./utils/api";
import {
  buildHeroSlides,
  normalizeAudience,
  normalizeProduct,
  normalizeSection
} from "./utils/storefrontModel";
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

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currentUser, setCurrentUser] = useState(null);

  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [productDraft, setProductDraft] = useState(EMPTY_PRODUCT);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const heroSlides = useMemo(
    () => buildHeroSlides(settings.heroImage, DEFAULT_HERO_ROTATION_IMAGES),
    [settings.heroImage]
  );

  const loadStore = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [storefrontPayload, mePayload] = await Promise.all([fetchStorefront(), fetchMe()]);
      const nextSettings = storefrontPayload?.settings
        ? { ...DEFAULT_SETTINGS, ...storefrontPayload.settings }
        : DEFAULT_SETTINGS;
      const nextProducts = Array.isArray(storefrontPayload?.products)
        ? storefrontPayload.products.map(normalizeProduct)
        : [];
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
      setProducts(nextProducts);
      setCurrentUser(mePayload?.user || null);
    } catch (requestError) {
      setLoadError(requestError.message || "Could not load storefront.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStore();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === "a") {
        navigate(currentUser?.role === "admin" ? "/admin" : "/admin/login");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentUser, navigate]);

  const startEdit = (product) => {
    setIsEditingProduct(true);
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

  const resetProductDraft = () => {
    setProductDraft(EMPTY_PRODUCT);
    setIsEditingProduct(false);
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setAdminMessage("");
    try {
      const payload = {
        id: isEditingProduct ? productDraft.id : undefined,
        name: productDraft.name.trim(),
        price: Number(productDraft.price) || 0,
        section: normalizeSection(productDraft.section),
        audience: normalizeAudience(productDraft.audience),
        ctaLabel: String(productDraft.ctaLabel || "").trim(),
        description: String(productDraft.description || "").trim(),
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
        heroTitle: settingsDraft.heroTitle.trim() || DEFAULT_SETTINGS.heroTitle,
        heroSubtitle: settingsDraft.heroSubtitle.trim() || DEFAULT_SETTINGS.heroSubtitle,
        heroButtonLabel: settingsDraft.heroButtonLabel.trim() || DEFAULT_SETTINGS.heroButtonLabel,
        heroImage: settingsDraft.heroImage.trim()
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
      const dataUrl = await fileToDataUrl(file);
      setProductDraft((current) => ({ ...current, image: dataUrl }));
      setAdminMessage("Product image uploaded.");
    } catch {
      setAdminMessage("Could not read selected product image.");
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

  const handleAdminLogout = async () => {
    await logout().catch(() => {});
    setCurrentUser(null);
    navigate("/admin/login", { replace: true });
  };

  if (isLoading) return <LoadingView />;
  if (loadError) return <ErrorView message={loadError} onRetry={loadStore} />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <StorefrontPage
            products={products}
            settings={settings}
            heroSlides={heroSlides}
            currentUser={currentUser}
            location={location}
            onNavigate={navigate}
            orderingEnabled={currentUser?.role !== "admin"}
          />
        }
      />
      <Route
        path="/admin/storefront"
        element={
          currentUser?.role === "admin" ? (
            <StorefrontPage
              products={products}
              settings={settings}
              heroSlides={heroSlides}
              currentUser={currentUser}
              location={location}
              onNavigate={navigate}
              orderingEnabled={false}
              isAdminPreview
            />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      />
      <Route
        path="/account/login"
        element={<AccountLoginPage currentUser={currentUser} onAuthenticated={setCurrentUser} />}
      />
      <Route path="/account/verify-email" element={<VerifyEmailPage onVerified={setCurrentUser} />} />
      <Route
        path="/account"
        element={
          currentUser ? (
            currentUser.role === "admin" ? (
              <Navigate to="/admin" replace />
            ) : (
            <AccountPage
              currentUser={currentUser}
              onLoggedOut={() => setCurrentUser(null)}
              onUserUpdated={setCurrentUser}
            />
            )
          ) : (
            <Navigate to="/account/login" replace />
          )
        }
      />
      <Route
        path="/admin/login"
        element={<AdminLoginPage currentUser={currentUser} onAuthenticated={setCurrentUser} />}
      />
      <Route
        path="/admin"
        element={
          currentUser?.role === "admin" ? (
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
              adminMessage={adminMessage}
              onOpenStorefront={() => navigate("/admin/storefront")}
              onLogout={handleAdminLogout}
            />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      />
      <Route path="/payment/callback" element={<PaymentCallbackPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
