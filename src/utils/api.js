async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload;
    throw error;
  }
  return payload;
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

export function fetchAllOrders() {
  return request("/api/orders");
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

export function updateSettings(payload) {
  return request("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
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
