import { useEffect, useMemo, useState } from "react";
import HeroArtwork from "../art/HeroArtwork";
import FeatureIcon from "../icons/FeatureIcon";

const ROTATION_INTERVAL_MS = 10000;

const HERO_PROMISE_ITEMS = [
  {
    type: "shipping",
    title: "Free Shipping",
    description: "Fast delivery on every order"
  },
  {
    type: "arrivals",
    title: "New Arrivals",
    description: "Fresh frame drops every week"
  },
  {
    type: "quality",
    title: "Quality Guarantee",
    description: "Premium lenses, premium finish"
  }
];

const VALID_EFFECTS = new Set(["fade", "zoom", "slide", "pan", "lift"]);
const VALID_POSITIONS = new Set(["left", "center", "right"]);
const DEFAULT_FOCUS = "50% 16%";

function normalizeEffect(value) {
  return VALID_EFFECTS.has(value) ? value : "fade";
}

function normalizePosition(value) {
  return VALID_POSITIONS.has(value) ? value : "center";
}

function normalizeFocus(value) {
  if (typeof value !== "string") return DEFAULT_FOCUS;
  const trimmed = value.trim();
  return trimmed || DEFAULT_FOCUS;
}

function HeroSection({ settings, heroSlides }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [failedSlides, setFailedSlides] = useState({});

  const slides = useMemo(() => {
    if (!Array.isArray(heroSlides) || heroSlides.length === 0) return [];
    return heroSlides.map((slide) => ({
      ...slide,
      effect: normalizeEffect(slide.effect),
      position: normalizePosition(slide.position),
      focus: normalizeFocus(slide.focus)
    }));
  }, [heroSlides]);

  useEffect(() => {
    setHeroIndex(0);
    setFailedSlides({});
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % slides.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const activeSlide = slides[heroIndex];
  const activeSrc = activeSlide?.src ?? "";
  const activeEffect = activeSlide?.effect ?? "fade";
  const activePosition = activeSlide?.position ?? "center";
  const activeFocus = activeSlide?.focus ?? DEFAULT_FOCUS;
  const isImageUsable = Boolean(activeSrc) && !failedSlides[activeSrc];

  return (
    <section className="hero-section" id="home">
      <div className="hero-main">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>{settings.heroTitle}</h1>
            <p>{settings.heroSubtitle}</p>
            <button
              type="button"
              onClick={() =>
                document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {settings.heroButtonLabel}
            </button>
          </div>

          <div className="hero-image-wrap">
            {isImageUsable ? (
              <img
                key={`${activeSrc}-${heroIndex}`}
                className={`hero-rotating-image hero-transition-${activeEffect} hero-position-${activePosition}`}
                src={activeSrc}
                alt={activeSlide.alt || "Model wearing eyeglasses"}
                style={{ objectPosition: activeFocus }}
                onError={() => {
                  setFailedSlides((current) => ({ ...current, [activeSrc]: true }));
                }}
              />
            ) : (
              <HeroArtwork />
            )}
          </div>
        </div>
      </div>

      <div className="container">
        <div className="hero-benefits" role="list" aria-label="Store benefits">
          {HERO_PROMISE_ITEMS.map((item) => (
            <article key={item.type} role="listitem">
              <FeatureIcon type={item.type} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
