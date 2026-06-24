import { DEFAULT_PRODUCT_DETAIL_BULLETS } from "../constants/storefront";

const BLOCKED_HERO_IMAGE_BASE_URLS = new Set([
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f"
]);
const KNOWN_AUDIENCES = new Set(["fashion", "women", "men", "sunglasses", "unisex", "antiblue", "photochromic", "prescrip"]);
const KNOWN_AVAILABILITY_VALUES = new Set(["in_stock", "out_of_stock", "preorder"]);

export function isBlockedHeroImageSource(source) {
  const value = String(source || "").trim();
  if (!value) return false;
  const [baseUrl] = value.split("?");
  return BLOCKED_HERO_IMAGE_BASE_URLS.has(baseUrl);
}

export function normalizeSection(section) {
  if (section === "arrival") return "category";
  if (section === "featured") return "bestseller";
  return section;
}

export function normalizeAudience(value) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "unisex";
  if (KNOWN_AUDIENCES.has(source)) return source;
  const compact = source.replace(/[^a-z]/g, "");

  if (compact.includes("fashion")) {
    return "fashion";
  }

  if (compact.includes("photochromic")) {
    return "photochromic";
  }

  if (
    compact.includes("women") ||
    compact.includes("woman") ||
    compact.includes("female") ||
    compact.includes("lady")
  ) {
    return "women";
  }

  if (compact === "men" || compact === "man" || compact.includes("male") || compact.includes("gent")) {
    return "men";
  }

  if (compact.includes("sunglass") || compact.includes("shades")) {
    return "sunglasses";
  }

  if (
    compact.includes("antiblue") ||
    compact.includes("bluelight") ||
    compact.includes("antiglare")
  ) {
    return "antiblue";
  }

  if (compact.includes("prescrip") || compact.includes("prescription") || compact === "rx") {
    return "prescrip";
  }

  if (compact.includes("unisex")) return "unisex";
  return "unisex";
}

export function normalizeAudienceList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
  const normalized = source
    .map((entry) => normalizeAudience(entry))
    .filter((entry) => KNOWN_AUDIENCES.has(entry));
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : ["unisex"];
}

function normalizeDetailBullets(value) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  return normalized.length > 0 ? normalized : DEFAULT_PRODUCT_DETAIL_BULLETS;
}

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "in_stock";
  if (KNOWN_AVAILABILITY_VALUES.has(source)) return source;

  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "instock" || compact === "available") return "in_stock";
  if (compact === "outofstock" || compact === "soldout" || compact === "unavailable") {
    return "out_of_stock";
  }
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

export function normalizeProduct(product) {
  const audiences = normalizeAudienceList(product.audiences || product.audience);
  const availability = normalizeAvailability(product.availability);
  return {
    ...product,
    section: normalizeSection(product.section),
    audience: audiences[0],
    audiences,
    availability,
    preorderNote: availability === "preorder" ? String(product.preorderNote || "").trim() : "",
    ctaLabel: product.ctaLabel || "",
    description: product.description || "",
    detailBullets: normalizeDetailBullets(product.detailBullets),
    variant: product.variant || "round",
    image: product.image || ""
  };
}

export function buildHeroSlides(primaryHeroImage, rotationImages) {
  const uniqueSlides = [];

  const pushSlide = (src, alt, effect = "fade", position = "center", focus = "50% 16%") => {
    const value = String(src || "").trim();
    if (!value) return;
    if (isBlockedHeroImageSource(value)) return;
    if (uniqueSlides.some((slide) => slide.src === value)) return;
    uniqueSlides.push({ src: value, alt, effect, position, focus });
  };

  pushSlide(
    primaryHeroImage,
    "Model wearing Ife ShadesnMore glasses",
    "fade",
    "center",
    "50% 14%"
  );

  (rotationImages || []).forEach((slide) => {
    pushSlide(slide.src, slide.alt, slide.effect, slide.position, slide.focus);
  });

  return uniqueSlides;
}
