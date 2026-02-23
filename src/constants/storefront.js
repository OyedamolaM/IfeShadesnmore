export const PRODUCT_STORAGE_KEY = "ife_shadesnmore_products_v2";
export const SETTINGS_STORAGE_KEY = "ife_shadesnmore_settings_v2";
export const CART_STORAGE_KEY = "ife_shadesnmore_cart_v1";
export const ORDER_STORAGE_KEY = "ife_shadesnmore_orders_v1";
export const PROFILE_STORAGE_KEY = "ife_shadesnmore_profile_v1";

export const AUDIENCE_OPTIONS = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "sunglasses", label: "Sunglasses" },
  { value: "unisex", label: "Unisex" },
  { value: "antiblue", label: "Anti-Blue / Anti-Glare" },
  { value: "prescrip", label: "Prescription" }
];

export const BULLET_ICON_TYPES = [
  { value: "shipping", label: "Shipping Icon" },
  { value: "arrivals", label: "Arrivals Icon" },
  { value: "quality", label: "Quality Icon" },
  { value: "returns", label: "Returns Icon" }
];

export const DEFAULT_HERO_PROMISE_ITEMS = [
  {
    type: "shipping",
    title: "Nation-wide Shipping",
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

export const DEFAULT_FEATURE_ITEMS = [
  {
    type: "quality",
    title: "Quality Lenses",
    description: "Premium Materials"
  },
  {
    type: "shipping",
    title: "Nationwide Delivery",
    description: "On All Orders"
  },
  {
    type: "returns",
    title: "7-Day Money-Back Guarantee",
    description: "Satisfaction Guaranteed"
  }
];

export const DEFAULT_PRODUCT_DETAIL_BULLETS = [
  "Blue light filter compatible",
  "Unisex fit",
  "Free cleaning cloth included"
];

export const DEFAULT_PRODUCTS = [
  {
    id: "women-category",
    name: "Women's Glasses",
    price: 32000,
    section: "category",
    audience: "women",
    ctaLabel: "Shop Women's",
    variant: "tortoise",
    description: "Elegant everyday frames for women with lightweight comfort.",
    detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
    image:
      "/hero/Female-glasses.jpg"
  },
  {
    id: "men-category",
    name: "Men's Glasses",
    price: 30000,
    section: "category",
    audience: "men",
    ctaLabel: "Shop Men's",
    variant: "square",
    description: "Classic masculine silhouettes built for daily wear.",
    detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
    image:
      "/hero/male-glasses.jpg"
  },
  {
    id: "sunglasses-category",
    name: "Sunglasses",
    price: 36000,
    section: "category",
    audience: "sunglasses",
    ctaLabel: "Shop Sunglasses",
    variant: "aviator",
    description: "UV-protected shades with polished fashion-forward finish.",
    detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
    image:
      "/hero/Sunglasses.jpg"
  },
  {
    id: "classic-round",
    name: "Classic Round",
    price: 30000,
    section: "bestseller",
    audience: "unisex",
    variant: "round",
    description: "A timeless round frame that complements any face shape.",
    detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
    image:
      "https://images.pexels.com/photos/14482342/pexels-photo-14482342.jpeg?cs=srgb&dl=pexels-studioautenticamx-14482342.jpg&fm=jpg"
  },
  {
    id: "modern-cat-eye",
    name: "Modern Cat-Eye",
    price: 34000,
    section: "bestseller",
    audience: "women",
    variant: "cat",
    description: "Bold cat-eye style with sharp edges and premium finish.",
    detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
    image:
      "https://images.pexels.com/photos/26682029/pexels-photo-26682029.jpeg?cs=srgb&dl=pexels-glassesshop-gs-1317359316-26682029.jpg&fm=jpg"
  },
  {
    id: "vintage-square",
    name: "Vintage Square",
    price: 28000,
    section: "bestseller",
    audience: "men",
    variant: "square",
    description: "Structured square frame inspired by vintage aesthetics.",
    detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
    image:
      "https://images.pexels.com/photos/5752395/pexels-photo-5752395.jpeg?cs=srgb&dl=pexels-kseniachernaya-5752395.jpg&fm=jpg"
  },
  {
    id: "aviator-sunglasses",
    name: "Aviator Sunglasses",
    price: 38000,
    section: "bestseller",
    audience: "sunglasses",
    variant: "aviator",
    description: "Modern aviator shape with dark lens for full sun coverage.",
    detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
    image:
      "https://images.pexels.com/photos/46710/pexels-photo-46710.jpeg?cs=srgb&dl=pexels-pixabay-46710.jpg&fm=jpg"
  }
];

export const DEFAULT_SETTINGS = {
  brandName: "IfeShadesnMore",
  brandTagline: "Fashion, Prescription, all in one place",
  heroTitle: "Confidence Perfectly Framed",
  heroSubtitle: "Look the class, style with pride, pay with less.",
  heroButtonLabel: "Shop Now",
  heroImage: "/hero/hero-candidate2.jpg",
  heroPromiseItems: DEFAULT_HERO_PROMISE_ITEMS,
  featureItems: DEFAULT_FEATURE_ITEMS
};

export const EMPTY_PRODUCT = {
  id: "",
  name: "",
  price: "",
  section: "category",
  audiences: ["unisex"],
  audience: "unisex",
  ctaLabel: "",
  description: "",
  detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
  detailBulletsText: DEFAULT_PRODUCT_DETAIL_BULLETS.join("\n"),
  variant: "round",
  image: ""
};

export const DEFAULT_HERO_ROTATION_IMAGES = [
  {
    src: "/hero/hero-candidate2.jpg",
    alt: "Smiling black woman wearing round eyeglasses",
    effect: "fade",
    position: "center",
    focus: "50% 14%"
  },
  {
    src: "/hero/africanlady.png",
    alt: "African woman wearing round eyeglasses",
    effect: "fade",
    position: "center",
    focus: "50% 16%"
  },
  {
    src: "/hero/hero-provided-like.jpg",
    alt: "Portrait of woman with gold eyeglasses",
    effect: "pan",
    position: "center",
    focus: "50% 12%"
  },
  {
    src: "/hero/hero-recent-1.jpg",
    alt: "Man wearing modern sunglasses outdoors",
    effect: "zoom",
    position: "center",
    focus: "50% 20%"
  },
  {
    src: "/hero/hero-recent-2.jpg",
    alt: "Woman with curly hair wearing statement eyeglasses",
    effect: "slide",
    position: "center",
    focus: "50% 18%"
  },
  {
    src: "/hero/hero-recent-3.jpg",
    alt: "Woman wearing square clear eyeglasses",
    effect: "pan",
    position: "center",
    focus: "50% 12%"
  },
  {
    src: "/hero/hero-recent-4.jpg",
    alt: "Woman in neutral top wearing bold eyeglasses",
    effect: "lift",
    position: "center",
    focus: "50% 16%"
  },
  {
    src: "/hero/hero-recent-5.jpg",
    alt: "Portrait model wearing premium eyeglasses",
    effect: "zoom",
    position: "center",
    focus: "50% 14%"
  },
  {
    src: "/hero/hero-recent-6.jpg",
    alt: "Woman in black dress wearing cat-eye glasses",
    effect: "fade",
    position: "center",
    focus: "50% 14%"
  },
  {
    src: "/hero/hero-male.jpg",
    alt: "Man wearing round blue-light glasses indoors",
    effect: "slide",
    position: "center",
    focus: "50% 18%"
  },
  {
    src: "/hero/hero-candidate3-man.jpg",
    alt: "Man wearing thin frame glasses",
    effect: "pan",
    position: "center",
    focus: "50% 18%"
  },
  {
    src: "/hero/hero-candidate1.jpg",
    alt: "Model with clear frame eyewear",
    effect: "lift",
    position: "center",
    focus: "50% 16%"
  },
  {
    src: "/hero/hero-link-1.jpg",
    alt: "Fashion portrait with white sunglasses",
    effect: "zoom",
    position: "center",
    focus: "50% 18%"
  },
  {
    src: "/hero/hero-link-2.jpg",
    alt: "Portrait with stacked sunglasses",
    effect: "slide",
    position: "center",
    focus: "50% 13%"
  }
];
