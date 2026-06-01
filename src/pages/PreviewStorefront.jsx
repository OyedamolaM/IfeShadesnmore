import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import PreviewStyleSwitcher from "../components/preview/PreviewStyleSwitcher";
import "./PreviewStorefront.css";

const VARIANTS = {
  v1: {
    label: "Spring Drop 2026",
    heroImage: "/preview/hero-v1-gallery.jpg",
    className: "preview-v1",
    kicker: "Quiet luxury",
    headline: ["Confidence,", "perfectly", "framed."],
    description:
      "Hand-selected luxury frames for fashion, prescription, and statement days, delivered nationwide.",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "1,200+ happy customers"
  },
  v2: {
    label: "Spring Drop 2026",
    heroImage: "/preview/hero-v2-earth.jpg",
    className: "preview-v2",
    kicker: "Warm earth edit",
    headline: ["Confidence,", "perfectly", "framed."],
    description:
      "A boutique eyewear edit with polished silhouettes, warm styling, and everyday Nigerian delivery.",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "Bestseller edit"
  },
  v3: {
    label: "Spring Drop 2026",
    heroImage: "/preview/hero-v3-solar.jpg",
    className: "preview-v3",
    kicker: "Solar editorial",
    headline: ["Confidence,", "perfectly", "framed."],
    description:
      "Bold frames with a sunlit editorial feel, made for customers who like their eyewear to speak first.",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "New drops every Friday"
  }
};

const VALUE_PROPS = [
  {
    title: "Nationwide shipping",
    description: "Fast delivery on every order, anywhere in Nigeria.",
    icon: "truck"
  },
  {
    title: "Weekly arrivals",
    description: "Fresh frame drops with a boutique, limited-stock feel.",
    icon: "sparkle"
  },
  {
    title: "Quality guaranteed",
    description: "Premium lenses, premium finish, and thoughtful support.",
    icon: "shield"
  }
];

const HERO_IMAGE_SEQUENCE = ["v1", "v2", "v3"];
const HERO_IMAGE_INTERVAL_MS = 4200;

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "out_of_stock" || source === "preorder" || source === "in_stock") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function iconGlyph(type) {
  if (type === "truck") return "TR";
  if (type === "shield") return "OK";
  return "*";
}

export function PreviewSupportSections({ onOpenAdmin }) {
  return (
    <>
      <section className="preview-editorial" id="editorial">
        <div>
          <p>Editorial</p>
          <h2>
            Made for the way <em>you show up</em>.
          </h2>
          <span>
            Every frame is selected for presence: soft enough for daylight, sharp enough for the room.
          </span>
        </div>
        <dl>
          <div>
            <dt>2k+</dt>
            <dd>Frames sold</dd>
          </div>
          <div>
            <dt>36</dt>
            <dd>States shipped</dd>
          </div>
          <div>
            <dt>4.9</dt>
            <dd>Customer rating</dd>
          </div>
        </dl>
      </section>

      <section className="preview-values">
        {VALUE_PROPS.map((item) => (
          <article key={item.title}>
            <span>{iconGlyph(item.icon)}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>

      <footer className="preview-footer" id="contact">
        <div>
          <h2>
            Join the <em>drop list</em>.
          </h2>
          <p>Early access to new frame drops, member-only updates, and restock notes.</p>
        </div>
        <form onSubmit={(event) => event.preventDefault()}>
          <input type="email" placeholder="your@email.com" aria-label="Email address" />
          <button type="submit">Join</button>
        </form>
        <nav aria-label="Footer navigation">
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/terms-of-service">Terms</Link>
          <button type="button" onClick={onOpenAdmin}>
            Admin
          </button>
        </nav>
      </footer>
    </>
  );
}

function PreviewStorefront({
  products,
  settings,
  currentUser,
  styleVariant,
  onStyleVariantChange,
  onOpenAdmin,
  onOpenCart,
  onOpenProfile,
  onOpenAbout,
  onViewProduct,
  onAddToCart,
  cartCount,
  allowOrdering = true,
  primaryShopTargetId = "preview-shop",
  rotateHeroImages = true,
  showSupportSections = true
}) {
  const variant = VARIANTS[styleVariant] || VARIANTS.v1;
  const [heroImageIndex, setHeroImageIndex] = useState(() =>
    Math.max(0, HERO_IMAGE_SEQUENCE.indexOf(styleVariant))
  );
  const brandName = settings?.brandName || "IfeShadesnMore";
  const visibleProducts = (products || [])
    .filter((product) => normalizeAvailability(product.availability) !== "out_of_stock")
    .slice(0, 4);
  const activeHeroImageKey = rotateHeroImages
    ? HERO_IMAGE_SEQUENCE[heroImageIndex % HERO_IMAGE_SEQUENCE.length]
    : styleVariant;
  const activeHeroImage = VARIANTS[activeHeroImageKey]?.heroImage || variant.heroImage;

  useEffect(() => {
    setHeroImageIndex(Math.max(0, HERO_IMAGE_SEQUENCE.indexOf(styleVariant)));
  }, [styleVariant]);

  useEffect(() => {
    if (!rotateHeroImages || typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % HERO_IMAGE_SEQUENCE.length);
    }, HERO_IMAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [rotateHeroImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    HERO_IMAGE_SEQUENCE.forEach((key) => {
      const image = new window.Image();
      image.src = VARIANTS[key].heroImage;
    });
  }, []);

  const shopNow = () => document.getElementById(primaryShopTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className={`preview-storefront ${variant.className}`}>
      <div className="preview-switcher-stack">
        <PreviewStyleSwitcher value={styleVariant} onChange={onStyleVariantChange} compactLabel="Theme" />
      </div>

      <header className="preview-nav">
        <button type="button" className="preview-brand" onDoubleClick={onOpenAdmin} aria-label="Open admin">
          <span>I</span>
          <strong>{brandName}</strong>
        </button>
        <nav aria-label="Primary navigation">
          <a href={`#${primaryShopTargetId}`}>Shop</a>
          <a href="#editorial">Editorial</a>
          <button type="button" onClick={onOpenAbout}>
            About
          </button>
        </nav>
        <div className="preview-nav-actions">
          <button type="button" onClick={onOpenProfile}>
            {currentUser ? "Account" : "Login"}
          </button>
          {allowOrdering ? (
            <button type="button" className="preview-cart-button" onClick={onOpenCart}>
              Cart
              {cartCount > 0 ? <span>{cartCount > 99 ? "99+" : cartCount}</span> : null}
            </button>
          ) : null}
        </div>
      </header>

      <main>
        <section className="preview-hero" id="home">
          <div className="preview-hero-copy">
            <p className="preview-kicker">
              <span />
              {variant.kicker}
            </p>
            <p className="preview-season">{variant.label}</p>
            <h1>
              {variant.headline[0]}
              <br />
              <em>{variant.headline[1]}</em>
              <br />
              {variant.headline[2]}
            </h1>
            <p className="preview-hero-text">{variant.description}</p>
            <div className="preview-actions">
              <button type="button" onClick={shopNow}>
                {variant.primary}
                <span aria-hidden="true">-&gt;</span>
              </button>
              <button type="button" onClick={shopNow}>
                {variant.secondary}
              </button>
            </div>
            <p className="preview-proof">{variant.statTone}</p>
          </div>
          <div className="preview-hero-media" aria-live="off">
            <img key={activeHeroImage} src={activeHeroImage} alt="IfeShades editorial eyewear preview" />
            {rotateHeroImages ? (
              <div className="preview-hero-dots" aria-hidden="true">
                {HERO_IMAGE_SEQUENCE.map((key) => (
                  <span key={key} className={key === activeHeroImageKey ? "is-active" : ""} />
                ))}
              </div>
            ) : null}
            <aside>
              <span>Bestseller</span>
              <strong>{visibleProducts[0]?.name || "Rhinestone Gold"}</strong>
            </aside>
          </div>
        </section>

        <div className="preview-ticker">
          <span>Free shipping over NGN 30k</span>
          <span>New drops every Friday</span>
          <span>Nationwide delivery</span>
          <span>Quality guaranteed</span>
        </div>

        {showSupportSections ? <PreviewSupportSections onOpenAdmin={onOpenAdmin} /> : null}
      </main>
    </div>
  );
}

export default PreviewStorefront;
