export const PRODUCT_STORAGE_KEY = "ife_shadesnmore_products_v2";
export const SETTINGS_STORAGE_KEY = "ife_shadesnmore_settings_v2";
export const CART_STORAGE_KEY = "ife_shadesnmore_cart_v1";
export const ORDER_STORAGE_KEY = "ife_shadesnmore_orders_v1";
export const PROFILE_STORAGE_KEY = "ife_shadesnmore_profile_v1";

export const AUDIENCE_OPTIONS = [
  { value: "fashion", label: "Fashion" },
  { value: "photochromic", label: "Photochromic" },
  { value: "antiblue", label: "Anti-blue" },
  { value: "prescrip", label: "Prescription" },
  { value: "women", label: "Female" },
  { value: "men", label: "Male" },
  { value: "unisex", label: "Unisex" },
  { value: "sunglasses", label: "Sunglasses" }
];

export const BULLET_ICON_TYPES = [
  { value: "shipping", label: "Shipping Icon" },
  { value: "arrivals", label: "Arrivals Icon" },
  { value: "quality", label: "Quality Icon" },
  { value: "returns", label: "Returns Icon" }
];

export const PRODUCT_AVAILABILITY_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "preorder", label: "Preorder" }
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

export const DEFAULT_SHIPPING_TIERS = [];

export const DEFAULT_REVIEW_ITEMS = [
  {
    name: "IfeShadesnMore customer",
    role: "Laptop user",
    rating: 5,
    image: "",
    text: "The frame looked exactly like the pictures and feels comfortable for long screen hours."
  },
  {
    name: "Verified buyer",
    role: "Working professional",
    rating: 5,
    image: "",
    text: "Beautiful glasses, neatly packaged, and easy to wear from work calls to evening plans."
  },
  {
    name: "Happy customer",
    role: "Tech customer",
    rating: 5,
    image: "",
    text: "I wanted stylish anti-blue glasses for laptop work and this made the choice simple."
  }
];

export const DEFAULT_FAQ_ITEMS = [
  {
    question: "Are anti-blue glasses good for laptop and phone users?",
    answer: "Yes. Anti-blue glasses are popular with people who spend long hours on laptops, phones, tablets, and office screens."
  },
  {
    question: "Who should buy photochromic glasses?",
    answer: "Photochromic glasses are useful if you move between indoor screens and outdoor light because the lenses adapt to changing brightness."
  },
  {
    question: "Do you deliver within Nigeria?",
    answer: "Yes. Delivery options and fees are shown during checkout before payment."
  }
];

export const DEFAULT_PRODUCTS = [];

export const DEFAULT_SETTINGS = {
  brandName: "IfeShadesnMore",
  brandTagline: "Fashion, Prescription, all in one place",
  heroKicker: "",
   heroTitle: "See Clearly, Work Comfortably, Look Classy",
  heroSubtitle: "Look the class, style with pride, pay with less.",
  heroButtonLabel: "Shop Now",
  heroImage: "/hero/hero-candidate2.jpg",
  heroPromiseItems: DEFAULT_HERO_PROMISE_ITEMS,
  featureItems: DEFAULT_FEATURE_ITEMS,
  shippingTiers: DEFAULT_SHIPPING_TIERS,
  reviewItems: DEFAULT_REVIEW_ITEMS,
  faqItems: DEFAULT_FAQ_ITEMS
};

export const EMPTY_PRODUCT = {
  id: "",
  name: "",
  price: "",
  section: "category",
  audiences: ["fashion", "unisex"],
  audience: "fashion",
  ctaLabel: "",
  description: "",
  detailBullets: DEFAULT_PRODUCT_DETAIL_BULLETS,
  detailBulletsText: DEFAULT_PRODUCT_DETAIL_BULLETS.join("\n"),
  availability: "in_stock",
  preorderNote: "",
  variant: "round",
  image: "",
  images: [],
  mainImageIndex: 0
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
