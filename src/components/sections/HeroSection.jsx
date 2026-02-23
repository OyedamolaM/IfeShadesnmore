import { useEffect, useMemo, useState } from "react";
import FeatureIcon from "../icons/FeatureIcon";
import { DEFAULT_HERO_PROMISE_ITEMS } from "../../constants/storefront";

const ROTATION_INTERVAL_MS = 5000;
const EFFECT_SEQUENCE = ["fade", "zoom", "slide", "pan", "lift"];

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
    return heroSlides.map((slide, index) => ({
      ...slide,
      // Keep transitions modern and varied per slide.
      effect: normalizeEffect(slide.effect || EFFECT_SEQUENCE[index % EFFECT_SEQUENCE.length]),
      position: normalizePosition(slide.position),
      focus: normalizeFocus(slide.focus)
    }));
  }, [heroSlides]);

  useEffect(() => {
    setHeroIndex(0);
    setFailedSlides({});
  }, [slides.length]);

  const usableSlides = useMemo(
    () => slides.filter((slide) => Boolean(slide.src) && !failedSlides[slide.src]),
    [slides, failedSlides]
  );

  const nextSlideIndex =
    usableSlides.length > 1 ? (heroIndex + 1) % usableSlides.length : heroIndex;

  useEffect(() => {
    if (!usableSlides.length) {
      setHeroIndex(0);
      return;
    }
    setHeroIndex((current) => current % usableSlides.length);
  }, [usableSlides.length]);

  useEffect(() => {
    if (usableSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % usableSlides.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [usableSlides.length]);

  const isImageUsable = usableSlides.length > 0;
  const heroPromiseItems = useMemo(() => {
    if (Array.isArray(settings?.heroPromiseItems) && settings.heroPromiseItems.length > 0) {
      return settings.heroPromiseItems;
    }
    return DEFAULT_HERO_PROMISE_ITEMS;
  }, [settings?.heroPromiseItems]);

  const goToPreviousSlide = () => {
    if (usableSlides.length <= 1) return;
    setHeroIndex((current) => (current - 1 + usableSlides.length) % usableSlides.length);
  };

  const goToNextSlide = () => {
    if (usableSlides.length <= 1) return;
    setHeroIndex((current) => (current + 1) % usableSlides.length);
  };

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
            <div className="hero-image-stage">
              {isImageUsable
                ? usableSlides.map((slide, index) => (
                    <img
                      key={slide.src}
                      className={`hero-rotating-image hero-transition-${slide.effect} hero-position-${slide.position} ${
                        index === heroIndex ? "is-active" : ""
                      }`}
                      src={index === heroIndex || index === nextSlideIndex ? slide.src : undefined}
                      loading={index === heroIndex ? "eager" : "lazy"}
                      fetchPriority={index === heroIndex ? "high" : "low"}
                      decoding="async"
                      alt={slide.alt || "Model wearing eyeglasses"}
                      style={{
                        objectPosition: slide.focus || DEFAULT_FOCUS,
                        "--hero-transition-duration": `${1800 + (index % 5) * 250}ms`
                      }}
                      onError={() => {
                        setFailedSlides((current) => ({ ...current, [slide.src]: true }));
                      }}
                    />
                  ))
                : null}

              {usableSlides.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="hero-nav-button hero-nav-prev"
                    onClick={goToPreviousSlide}
                    aria-label="Previous slide"
                  >
                    <span aria-hidden="true">&#8249;</span>
                  </button>
                  <button
                    type="button"
                    className="hero-nav-button hero-nav-next"
                    onClick={goToNextSlide}
                    aria-label="Next slide"
                  >
                    <span aria-hidden="true">&#8250;</span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="hero-benefits" role="list" aria-label="Store benefits">
          {heroPromiseItems.map((item, index) => (
            <article key={`${item.type || "benefit"}-${index}`} role="listitem">
              <FeatureIcon
                type={item.type || DEFAULT_HERO_PROMISE_ITEMS[index % DEFAULT_HERO_PROMISE_ITEMS.length].type}
              />
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
