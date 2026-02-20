import { useEffect, useMemo, useState } from "react";
import Header from "./components/layout/Header";
import HeroSection from "./components/sections/HeroSection";
import FeatureStrip from "./components/sections/FeatureStrip";
import ArrivalsSection from "./components/sections/ArrivalsSection";
import ContactSection from "./components/sections/ContactSection";
import AdminOverlay from "./components/admin/AdminOverlay";
import {
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS,
  EMPTY_PRODUCT,
  PRODUCT_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from "./constants/storefront";
import { readStoredValue } from "./utils/storage";
import { fileToDataUrl } from "./utils/files";

function generateProductId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `product-${Date.now()}`;
}

function mergeProductsWithDefaults(storedProducts) {
  if (!Array.isArray(storedProducts) || storedProducts.length === 0) {
    return DEFAULT_PRODUCTS;
  }

  const defaultById = DEFAULT_PRODUCTS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  return storedProducts.map((item) => {
    const fallback = defaultById[item.id];
    if (!fallback) return item;

    return {
      ...fallback,
      ...item,
      image: item.image || fallback.image
    };
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
      heroImage: merged.heroImage || DEFAULT_SETTINGS.heroImage
    };
  });
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [showAdmin, setShowAdmin] = useState(false);
  const [productDraft, setProductDraft] = useState(EMPTY_PRODUCT);
  const [isEditing, setIsEditing] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");

  useEffect(() => {
    window.localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (showAdmin) {
      setSettingsDraft(settings);
    }
  }, [settings, showAdmin]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === "a") {
        setShowAdmin(true);
      }
      if (event.key === "Escape") {
        setShowAdmin(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const arrivalProducts = useMemo(
    () => products.filter((product) => product.section === "arrival").slice(0, 3),
    [products]
  );

  const featuredProducts = useMemo(() => {
    const featured = products.filter((product) => product.section === "featured");
    if (featured.length >= 2) return featured.slice(0, 2);
    return products.slice(0, 2);
  }, [products]);

  const startEdit = (product) => {
    setIsEditing(true);
    setProductDraft({
      ...product,
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
    if (!productDraft.name.trim() || !String(productDraft.price).trim()) {
      setAdminMessage("Name and price are required.");
      return;
    }

    const normalized = {
      ...productDraft,
      id: isEditing && productDraft.id ? productDraft.id : generateProductId(),
      name: productDraft.name.trim(),
      price: Number(productDraft.price),
      image: (productDraft.image || "").trim()
    };

    if (Number.isNaN(normalized.price) || normalized.price < 0) {
      setAdminMessage("Price must be a valid number.");
      return;
    }

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
      heroTitle: settingsDraft.heroTitle.trim() || DEFAULT_SETTINGS.heroTitle,
      heroSubtitle: settingsDraft.heroSubtitle.trim() || DEFAULT_SETTINGS.heroSubtitle,
      heroButtonLabel: settingsDraft.heroButtonLabel.trim() || DEFAULT_SETTINGS.heroButtonLabel,
      heroImage: settingsDraft.heroImage.trim()
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

  return (
    <>
      <div className="page">
        <Header brandName={settings.brandName} onOpenAdmin={() => setShowAdmin(true)} />
        <main>
          <HeroSection settings={settings} />
          <FeatureStrip />
          <ArrivalsSection arrivalProducts={arrivalProducts} featuredProducts={featuredProducts} />
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
          onClose={() => setShowAdmin(false)}
        />
      ) : null}
    </>
  );
}

export default App;
