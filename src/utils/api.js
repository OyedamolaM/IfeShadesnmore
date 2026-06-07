const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const DEFAULT_REQUEST_TIMEOUT_MS = readPositiveInteger(
  import.meta.env.VITE_API_TIMEOUT_MS,
  15000
);
const DEFAULT_UPLOAD_TIMEOUT_MS = readPositiveInteger(
  import.meta.env.VITE_UPLOAD_TIMEOUT_MS,
  60000
);

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildApiUrl(path) {
  const route = String(path || "");
  if (!API_BASE_URL) return route;
  if (!route.startsWith("/")) return `${API_BASE_URL}/${route}`;
  return `${API_BASE_URL}${route}`;
}

async function request(path, options = {}) {
  const { headers, timeoutMs, signal, ...fetchOptions } = options;
  const controller = !signal && typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), readPositiveInteger(timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS))
    : null;

  try {
    const response = await fetch(buildApiUrl(path), {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(headers || {})
      },
      signal: signal || controller?.signal,
      ...fetchOptions
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function fetchStorefront() {
  return request("/api/storefront");
}

export function fetchMe() {
  return request("/api/auth/me");
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function loginWithGoogle(credential) {
  return request("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential })
  });
}

export function register(payload) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function verifyEmailToken(token) {
  return request("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export function resendVerificationEmail(email) {
  return request("/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export function updateProfile(payload) {
  return request("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updatePassword(payload) {
  return request("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchMyOrders() {
  return request("/api/orders/my");
}

export function fetchAccountDashboard() {
  return request("/api/account/dashboard");
}

export function updateAccountPreferences(payload) {
  return request("/api/account/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateAccountSecurity(payload) {
  return request("/api/account/security", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function uploadAccountAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_UPLOAD_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(buildApiUrl("/api/account/avatar"), {
      method: "POST",
      credentials: "include",
      signal: controller?.signal,
      body: formData
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Upload timed out. Please try a smaller image or try again.");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function createAccountAddress(payload) {
  return request("/api/account/addresses", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAccountAddress(addressId, payload) {
  return request(`/api/account/addresses/${encodeURIComponent(addressId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteAccountAddress(addressId) {
  return request(`/api/account/addresses/${encodeURIComponent(addressId)}`, {
    method: "DELETE"
  });
}

export function setDefaultAccountAddress(addressId) {
  return request(`/api/account/addresses/${encodeURIComponent(addressId)}/default`, {
    method: "PATCH"
  });
}

export function addWishlistItem(productId) {
  return request(`/api/account/wishlist/${encodeURIComponent(productId)}`, {
    method: "POST"
  });
}

export function removeWishlistItem(productId) {
  return request(`/api/account/wishlist/${encodeURIComponent(productId)}`, {
    method: "DELETE"
  });
}

export function fetchAllOrders() {
  return request("/api/orders");
}

export function createAdminOrder(payload) {
  return request("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateOrderStatus(orderId, orderStatus) {
  return request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ orderStatus })
  });
}

export function fetchAdminCustomers() {
  return request("/api/admin/customers");
}

export function createAdminCustomer(payload) {
  return request("/api/admin/customers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteAdminCustomer(customerId) {
  return request(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
    method: "DELETE"
  });
}

export function createSubscription(payload) {
  return request("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchSubscriptions() {
  return request("/api/subscriptions");
}

export function updateSubscription(subscriptionId, payload) {
  return request(`/api/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function sendNewsletter(payload) {
  return request("/api/newsletters/send", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 60000
  });
}

export function updateSettings(payload) {
  return request("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function uploadImage(file, kind = "product") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_UPLOAD_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(buildApiUrl("/api/uploads/image"), {
      method: "POST",
      credentials: "include",
      signal: controller?.signal,
      body: formData
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Upload timed out. Please try a smaller image or try again.");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function createProduct(payload) {
  return request("/api/products", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProduct(productId, payload) {
  return request(`/api/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteProduct(productId) {
  return request(`/api/products/${encodeURIComponent(productId)}`, {
    method: "DELETE"
  });
}

export function fetchAdminBlogs() {
  return request("/api/blogs");
}

export function createBlog(payload) {
  return request("/api/blogs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateBlog(blogId, payload) {
  return request(`/api/blogs/${encodeURIComponent(blogId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteBlog(blogId) {
  return request(`/api/blogs/${encodeURIComponent(blogId)}`, {
    method: "DELETE"
  });
}

export function initializeCheckout(payload) {
  return request("/api/checkout/initialize", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function verifyCheckout(reference) {
  return request(`/api/checkout/verify?reference=${encodeURIComponent(reference)}`);
}

export function fetchAdminBootstrapState() {
  return request("/api/admin/bootstrap-state");
}
