import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import CartIcon from "../components/icons/CartIcon";
import PreviewStyleSwitcher from "../components/preview/PreviewStyleSwitcher";
import "./PreviewStorefront.css";

const VARIANTS = {
  v1: {
    label: "",
    heroImage: "/preview/hero-v1-gallery.jpg",
    className: "preview-v1",
    headline: ["Confidence,", "perfectly", "framed."],
    description: "Luxury frames for fashion, prescription, and statement days.",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "1,200+ happy customers"
  },
  v2: {
    label: "",
    heroImage: "/preview/hero-v2-earth.jpg",
    className: "preview-v2",
    headline: ["Confidence,", "perfectly", "framed."],
    description: "A warm boutique edit of polished everyday eyewear.",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "1,200+ happy customers"
  },
  v3: {
    label: "",
    heroImage: "/preview/hero-v3-solar.jpg",
    className: "preview-v3",
    headline: ["Confidence,", "perfectly", "framed."],
    description: "Bold frames with a sunlit editorial feel.",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "1,200+ happy customers"
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

const HERO_SLIDES = [
  {
    id: "minimalist-gallery",
    themeKey: "v1",
    image: VARIANTS.v1.heroImage,
    alt: "IfeShades editorial eyewear preview",
    label: "Best seller",
    title: "Photochromic Antiblue"
  },
  {
    id: "warm-earth",
    themeKey: "v2",
    image: VARIANTS.v2.heroImage,
    alt: "Warm editorial eyewear preview",
    label: "Best seller",
    title: "Rhinstone Classic"
  },
  {
    id: "solar-editorial",
    themeKey: "v3",
    image: VARIANTS.v3.heroImage,
    alt: "Solar editorial eyewear preview",
    label: "Best seller",
    title: "Solar Tints"
  },
  {
    id: "round-blue-light",
    image: "/hero/hero-male.jpg",
    alt: "Man wearing round blue-light glasses indoors",
    label: "Best seller",
    title: "Anti Blue-Light Filter"
  },
  {
    id: "gold-optical",
    image: "/hero/hero-recent-6.jpg",
    alt: "Woman wearing gold optical glasses",
    label: "Best seller",
    title: "Fashion Anti-blue-Light"
  },
  {
    id: "modern-sun",
    image: "/hero/hero-recent-1.jpg",
    alt: "Man wearing modern sunglasses outdoors",
    label: "Best seller",
    title: "Photochromic Sunglasses"
  },
  {
    id: "statement-cat-eye",
    image: "/hero/hero-recent-3.jpg",
    alt: "Woman wearing statement cat-eye eyeglasses",
    label: "Best seller",
    title: "Rhinestone Gold"
  }
];
const HERO_IMAGE_INTERVAL_MS = 4200;
const BLOG_SWIPER_INTERVAL_MS = 5200;
const PLACEHOLDER_BLOGS = [
  {
    id: "style-guide-placeholder",
    title: "How to choose frames that match your mood",
    excerpt: "A simple guide to choosing frame shapes, colors, and finishes that feel natural on your face.",
    image: "/preview/hero-v1-gallery.jpg",
    author: "IfeShadesnMore",
    createdAt: ""
  }
];

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "out_of_stock" || source === "preorder" || source === "in_stock") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function getDefaultHeroKicker() {
  const month = new Date().toLocaleString("en", { month: "long" });
  return `${month} Drop`;
}

function heroSlideIndexForTheme(styleVariant) {
  const index = HERO_SLIDES.findIndex((slide) => slide.themeKey === styleVariant);
  return index === -1 ? 0 : index;
}

function iconGlyph(type) {
  if (type === "truck") return "TR";
  if (type === "shield") return "OK";
  return "*";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function blogSlugId(blog) {
  const slug = slugify(blog?.title || blog?.id || "blog") || "blog";
  return `${slug}--${encodeURIComponent(blog.id)}`;
}

export function PreviewSupportSections({ blogs = [], onOpenAdmin, includeFooter = true }) {
  const blogItems = (Array.isArray(blogs) && blogs.length > 0 ? blogs : PLACEHOLDER_BLOGS).filter(Boolean);
  const [activeBlogIndex, setActiveBlogIndex] = useState(0);
  const activeBlog = blogItems[activeBlogIndex % blogItems.length] || PLACEHOLDER_BLOGS[0];

  useEffect(() => {
    setActiveBlogIndex(0);
  }, [blogItems.length]);

  useEffect(() => {
    if (blogItems.length < 2 || typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => {
      setActiveBlogIndex((current) => (current + 1) % blogItems.length);
    }, BLOG_SWIPER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [blogItems.length]);

  return (
    <>
      <section className="preview-editorial" id="editorial">
        <div>
          <p>Blog</p>
          <h2>
            Read the <em>latest</em>.
          </h2>
          <div className="preview-editorial-copy">
            <span>
              Styling stories, care notes, and frame guides written for customers who want their eyewear to feel intentional, not random.
            </span>
            <span>
              Learn how to choose shapes that soften or sharpen your look, pick lens colors for different moods, and care for your frames between wears.
            </span>
            <span>
              New posts will cover drops, bestsellers, prescriptions, anti-blue lenses, and everyday styling ideas from the IfeShadesnMore edit.
            </span>
          </div>
        </div>
        <article className="preview-blog-card" aria-live="polite">
          {activeBlog.image ? <img src={activeBlog.image} alt="" /> : null}
          <div>
            <p>Blog</p>
            <h3>{activeBlog.title}</h3>
            <span>{activeBlog.excerpt}</span>
            <Link to="/blog/$slugId" params={{ slugId: blogSlugId(activeBlog) }}>
              Read more
            </Link>
          </div>
          {blogItems.length > 1 ? (
            <div className="preview-blog-dots" aria-label="Blog posts">
              {blogItems.map((blog, index) => (
                <button
                  key={blog.id}
                  type="button"
                  className={index === activeBlogIndex ? "is-active" : ""}
                  onClick={() => setActiveBlogIndex(index)}
                  aria-label={`Show ${blog.title}`}
                />
              ))}
            </div>
          ) : null}
        </article>
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

      {includeFooter ? (
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
      ) : null}
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
  blogs = [],
  cartCount,
  allowOrdering = true,
  primaryShopTargetId = "editorial",
  rotateHeroImages = true,
  showSupportSections = true
}) {
  const variant = VARIANTS[styleVariant] || VARIANTS.v1;
  const [heroImageIndex, setHeroImageIndex] = useState(() =>
    heroSlideIndexForTheme(styleVariant)
  );
  const brandName = settings?.brandName || "IfeShadesnMore";
  const heroKicker = String(settings?.heroKicker || "").trim() || getDefaultHeroKicker();
  const visibleProducts = (products || [])
    .filter((product) => normalizeAvailability(product.availability) !== "out_of_stock")
    .slice(0, 4);
  const activeHeroIndex = rotateHeroImages
    ? heroImageIndex % HERO_SLIDES.length
    : heroSlideIndexForTheme(styleVariant);
  const activeHeroSlide = HERO_SLIDES[activeHeroIndex] || HERO_SLIDES[0];

  useEffect(() => {
    setHeroImageIndex(heroSlideIndexForTheme(styleVariant));
  }, [styleVariant]);

  useEffect(() => {
    if (!rotateHeroImages || typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, HERO_IMAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [rotateHeroImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    HERO_SLIDES.forEach((slide) => {
      const image = new window.Image();
      image.src = slide.image;
    });
  }, []);

  const shopNow = () => document.getElementById(primaryShopTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className={`preview-storefront ${variant.className}`}>
      <header className="preview-nav">
        <button type="button" className="preview-brand" onDoubleClick={onOpenAdmin} aria-label="Open admin">
          <img src="/brand/ife-logo-circle.png" alt="" />
          <strong>{brandName}</strong>
        </button>
        <nav aria-label="Primary navigation">
          <a href={`#${primaryShopTargetId}`}>Shop</a>
          <a href="#editorial">Blog</a>
          <button type="button" onClick={onOpenAbout}>
            About
          </button>
        </nav>
        <div className="preview-nav-actions">
          <PreviewStyleSwitcher value={styleVariant} onChange={onStyleVariantChange} compactLabel="Theme" />
          <button type="button" onClick={onOpenProfile}>
            {currentUser ? "Account" : "Login"}
          </button>
          {allowOrdering ? (
            <button type="button" className="preview-cart-button" onClick={onOpenCart} aria-label="Open cart">
              <CartIcon />
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
              {heroKicker}
            </p>
            {variant.label ? <p className="preview-season">{variant.label}</p> : null}
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
            <div className="preview-proof" aria-label={variant.statTone}>
              <span className="preview-proof-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{variant.statTone}</span>
            </div>
          </div>
          <div className="preview-hero-media" aria-live="off">
            <img key={activeHeroSlide.image} src={activeHeroSlide.image} alt={activeHeroSlide.alt} />
            {rotateHeroImages ? (
              <div className="preview-hero-dots" aria-hidden="true">
                {HERO_SLIDES.map((slide, index) => (
                  <span key={slide.id} className={index === activeHeroIndex ? "is-active" : ""} />
                ))}
              </div>
            ) : null}
            <aside>
              <span>{activeHeroSlide.label}</span>
              <strong>{activeHeroSlide.title}</strong>
            </aside>
          </div>
        </section>

        <div className="preview-ticker">
          <span>New drops every Month</span>
          <span>Nationwide delivery</span>
          <span>Bulk purchase discounts</span>
        </div>

        {showSupportSections ? <PreviewSupportSections blogs={blogs} onOpenAdmin={onOpenAdmin} /> : null}
      </main>
    </div>
  );
}

export default PreviewStorefront;
