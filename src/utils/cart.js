import { CART_STORAGE_KEY } from "../constants/storefront";

export function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "in_stock" || source === "out_of_stock" || source === "preorder") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

export function splitFullName(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function createCheckoutForm(user) {
  const nameParts = splitFullName(user?.fullName);
  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    addressId: "",
    paymentMethod: "card",
    shippingTierId: ""
  };
}

export function parseStoredCart(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        productId: String(entry?.productId || "").trim(),
        quantity: Math.max(0, Number(entry?.quantity) || 0)
      }))
      .filter((entry) => entry.productId && entry.quantity > 0);
  } catch {
    return [];
  }
}

export function readStoredCart() {
  if (typeof window === "undefined") return [];
  return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
}

export function writeStoredCart(cart) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(cart);
  window.localStorage.setItem(CART_STORAGE_KEY, serialized);
  // Let other mounted instances (and the tab itself) know the cart changed.
  window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, newValue: serialized }));
}

export function buildLoginRedirect(path = "/") {
  return `/account/login?redirect=${encodeURIComponent(path)}`;
}

export function buildCheckoutLoginRedirect() {
  const params = new URLSearchParams({ openCart: "1", openCheckout: "1" });
  return `/account/login?redirect=${encodeURIComponent(`/?${params.toString()}`)}`;
}