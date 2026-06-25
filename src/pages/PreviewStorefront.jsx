import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import CartIcon from "../components/icons/CartIcon";
import ProfileIcon from "../components/icons/ProfileIcon";
import PreviewStyleSwitcher from "../components/preview/PreviewStyleSwitcher";

const VARIANTS = {
  v1: {
    label: "",
    heroImage: "/preview/hero-v1-gallery.jpg",
    className: "preview-v1",
    headline: ["Eyes protected", "Style elevated"],
    description: "Lenses that shift with the light. Style that doesn't",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "1,200+ happy customers"
  },
  v2: {
    label: "",
    heroImage: "/preview/hero-v2-earth.jpg",
    className: "preview-v2",
    headline: ["Eyes protected", "Style elevated"],
    description: "Lenses that shift with the light. Style that doesn't",
    primary: "Shop the drop",
    secondary: "Explore collections",
    statTone: "1,200+ happy customers"
  },
  v3: {
    label: "",
    heroImage: "/preview/hero-v3-solar.jpg",
    className: "preview-v3",
    headline: ["Eyes protected", "Style elevated"],
    description: "Lenses that shift with the light. Style that doesn't",
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
    title: "Rhinestone Classic"
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
const TESTIMONIAL_AUTOPLAY_MS = 6000;
const WHATSAPP_NUMBER = "2349063556765";
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

function AdminProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 18.2 6v4.5c0 4.1-2.4 7.7-6.2 9.3-3.8-1.6-6.2-5.2-6.2-9.3V6L12 3.5Z" />
      <path d="M9.2 12.4 11 14.2l3.9-4.4" />
    </svg>
  );
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

export function PreviewSupportSections({ blogs = [], reviewItems = [], faqItems = [], onOpenAdmin, includeFooter = true }) {
  const blogItems = (Array.isArray(blogs) && blogs.length > 0 ? blogs : PLACEHOLDER_BLOGS).filter(Boolean);
  const reviews = Array.isArray(reviewItems) ? reviewItems.filter((item) => item?.name && item?.text) : [];
  const faqs = Array.isArray(faqItems) ? faqItems.filter((item) => item?.question && item?.answer) : [];
  const [activeBlogIndex, setActiveBlogIndex] = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [isReviewPaused, setIsReviewPaused] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const reviewTouchX = useRef(null);
  const activeBlog = blogItems[activeBlogIndex % blogItems.length] || PLACEHOLDER_BLOGS[0];
  const activeReview = reviews.length > 0 ? reviews[activeReviewIndex % reviews.length] : null;

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

  useEffect(() => {
    setActiveReviewIndex(0);
  }, [reviews.length]);

  useEffect(() => {
    if (isReviewPaused || reviews.length <= 1 || typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => {
      setActiveReviewIndex((current) => (current + 1) % reviews.length);
    }, TESTIMONIAL_AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [isReviewPaused, reviews.length]);

  const goToReview = (index) => {
    if (reviews.length === 0) return;
    setActiveReviewIndex((index + reviews.length) % reviews.length);
  };

  const nextReview = () => goToReview(activeReviewIndex + 1);
  const previousReview = () => goToReview(activeReviewIndex - 1);

  const handleReviewTouchStart = (event) => {
    reviewTouchX.current = event.touches[0]?.clientX ?? null;
  };

  const handleReviewTouchEnd = (event) => {
    if (reviewTouchX.current == null) return;
    const dx = (event.changedTouches[0]?.clientX ?? 0) - reviewTouchX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) nextReview();
      else previousReview();
    }
    reviewTouchX.current = null;
  };

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

      {activeReview ? (
        <section className="preview-reviews" id="reviews">
          <div className="preview-centered-heading">
            <p>Reviews</p>
            <h2>Customers are seeing the difference.</h2>
            <span>Real notes from people choosing better frames for work, screens, and everyday style.</span>
          </div>
          <div
            className="preview-testimonial-carousel"
            onMouseEnter={() => setIsReviewPaused(true)}
            onMouseLeave={() => setIsReviewPaused(false)}
            onTouchStart={handleReviewTouchStart}
            onTouchEnd={handleReviewTouchEnd}
            aria-roledescription="carousel"
            aria-label="Customer reviews"
          >
            <article key={`${activeReview.name}-${activeReviewIndex}`} className="preview-testimonial-card">
              <div className="preview-review-rating" aria-label={`${Number(activeReview.rating) || 5} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <span key={starIndex} className={starIndex < Math.min(5, Math.max(1, Number(activeReview.rating) || 5)) ? "is-filled" : ""}>*</span>
                ))}
              </div>
              <blockquote>"{activeReview.text}"</blockquote>
              <footer>
                <div className="preview-review-avatar" aria-hidden="true">
                  {String(activeReview.name || "C").trim().slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong>{activeReview.name}</strong>
                  {activeReview.role ? <span>{activeReview.role}</span> : null}
                </div>
                {activeReview.role ? (
                  <div className="preview-review-result">
                    <small>Use case</small>
                    <b>{activeReview.role}</b>
                  </div>
                ) : null}
              </footer>
            </article>
            {reviews.length > 1 ? (
              <div className="preview-testimonial-controls">
                <button type="button" onClick={previousReview} aria-label="Previous review">‹</button>
                <div className="preview-testimonial-dots" role="tablist" aria-label="Customer reviews">
                  {reviews.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={index === activeReviewIndex}
                      className={index === activeReviewIndex ? "is-active" : ""}
                      onClick={() => goToReview(index)}
                      aria-label={`Go to review ${index + 1}`}
                    />
                  ))}
                </div>
                <button type="button" onClick={nextReview} aria-label="Next review">›</button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {faqs.length > 0 ? (
        <section className="preview-faq" id="faq">
          <div className="preview-centered-heading">
            <p>FAQ</p>
            <h2>Common questions</h2>
            <span>Everything you need to know before choosing your next frame.</span>
          </div>
          <div className="preview-faq-list">
            {faqs.slice(0, 8).map((item, index) => (
              <div key={`${item.question}-${index}`} className="preview-faq-item">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  aria-expanded={openFaqIndex === index}
                >
                  <span>{item.question}</span>
                  <b aria-hidden="true">{openFaqIndex === index ? "-" : "+"}</b>
                </button>
                {openFaqIndex === index ? <p>{item.answer}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
          <a href="#reviews">Reviews</a>
          <a href="#faq">FAQ</a>
          <button type="button" onClick={onOpenAbout}>
            About
          </button>
        </nav>
        <div className="preview-nav-actions">
          <PreviewStyleSwitcher value={styleVariant} onChange={onStyleVariantChange} compactLabel="Theme" />
          {onOpenProfile ? (
            <button
              type="button"
              className="preview-account-button"
              onClick={onOpenProfile}
              aria-label={currentUser ? "Open account" : "Log in"}
              title={currentUser ? "Account" : "Login"}
            >
              <ProfileIcon />
            </button>
          ) : null}
          {currentUser?.role === "admin" && onOpenAdmin ? (
            <button
              type="button"
              className="preview-account-button preview-admin-button"
              onClick={onOpenAdmin}
              aria-label="Open admin"
              title="Admin"
            >
              <AdminProfileIcon />
            </button>
          ) : null}
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
              <span className="preview-hero-line">{variant.headline[0]}</span>
              <br />
              <span className="preview-hero-tail">
                <em className="preview-hero-emphasis">{variant.headline[1]}</em>
                {" "}
                {variant.headline[2]}
              </span>
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
            <div className="preview-hero-image-stack">
              {HERO_SLIDES.map((slide, index) => (
                <img
                  key={slide.id}
                  className={index === activeHeroIndex ? "is-active" : ""}
                  src={slide.image}
                  alt={index === activeHeroIndex ? slide.alt : ""}
                  aria-hidden={index === activeHeroIndex ? undefined : "true"}
                />
              ))}
            </div>
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

        <a
          className="preview-whatsapp-float"
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with IfeShadesnMore on WhatsApp"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.2 19.4 6.4 15.9a7.4 7.4 0 1 1 2 2Z" />
            <path d="M9.1 8.5c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4 0 .6l-.4.5c-.1.1-.2.3 0 .5.4.8 1.2 1.8 2.2 2.3.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.8.8c.3.1.4.3.4.5 0 .5-.3 1.3-.9 1.6-.6.4-1.8.4-3.1-.2-1.5-.7-3-1.9-4.1-3.4-1-1.4-1.3-2.6-.9-3.4l.3-.6Z" />
          </svg>
        </a>

        {showSupportSections ? <PreviewSupportSections blogs={blogs} reviewItems={settings?.reviewItems} faqItems={settings?.faqItems} onOpenAdmin={onOpenAdmin} /> : null}
      </main>
    </div>
  );
}

export default PreviewStorefront;
