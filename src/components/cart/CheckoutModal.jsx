import { toPrice } from "../../utils/format";

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "in_stock" || source === "out_of_stock" || source === "preorder") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function resolvePreorderNote(item) {
  const raw = String(item?.product?.preorderNote || "").trim();
  if (raw) return raw;
  return "Preorder item. Shipping timeline will be confirmed before dispatch.";
}

function CheckoutModal({
  open,
  onClose,
  items,
  subtotal,
  shippingTiers = [],
  selectedShippingTierId,
  shippingFee = 0,
  total = subtotal,
  form,
  savedAddresses = [],
  onFieldChange,
  onSubmit,
  checkoutError,
  checkoutNotice,
  isSubmitting
}) {
  if (!open) return null;

  return (
    <div className="commerce-overlay checkout-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div className="checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout" onClick={(event) => event.stopPropagation()}>
        <div className="checkout-header">
          <h2>Secure Checkout</h2>
          <button
            type="button"
            className="close-x"
            onClick={onClose}
            aria-label="Close checkout"
            disabled={isSubmitting}
          >
            x
          </button>
        </div>

        <div className="checkout-content">
          <form className="checkout-form" onSubmit={onSubmit}>
            <div className="split-input-row">
              <label>
                <span>
                  First name <span className="required-mark">*</span>
                </span>
                <input
                  value={form.firstName}
                  onChange={(event) => onFieldChange("firstName", event.target.value)}
                  placeholder="First name"
                  disabled={isSubmitting}
                />
              </label>
              <label>
                <span>
                  Last name <span className="required-mark">*</span>
                </span>
                <input
                  value={form.lastName}
                  onChange={(event) => onFieldChange("lastName", event.target.value)}
                  placeholder="Last name"
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => onFieldChange("email", event.target.value)}
                placeholder="customer@email.com"
                disabled={isSubmitting}
              />
            </label>
            <label>
              Phone number
              <input
                value={form.phone}
                onChange={(event) => onFieldChange("phone", event.target.value)}
                placeholder="+234..."
                disabled={isSubmitting}
              />
            </label>
            <p className="checkout-hint">Phone or email is required for order updates.</p>
            {savedAddresses.length > 0 ? (
              <label>
                Saved address
                <select
                  value={form.addressId || ""}
                  onChange={(event) => onFieldChange("addressId", event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Enter a new address</option>
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label || "Address"} - {address.street}, {address.city}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>
                Shipping address <span className="required-mark">*</span>
              </span>
              <input
                value={form.address}
                onChange={(event) => onFieldChange("address", event.target.value)}
                placeholder="Street and area"
                disabled={isSubmitting}
              />
            </label>
            <label>
              <span>
                City <span className="required-mark">*</span>
              </span>
              <input
                value={form.city}
                onChange={(event) => onFieldChange("city", event.target.value)}
                placeholder="City"
                disabled={isSubmitting}
              />
            </label>
            <label>
              Shipping
              <select
                value={selectedShippingTierId || form.shippingTierId || ""}
                onChange={(event) => onFieldChange("shippingTierId", event.target.value)}
                disabled={isSubmitting}
                required
              >
                {shippingTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} - {toPrice(tier.fee)}
                  </option>
                ))}
              </select>
            </label>
            {shippingTiers.find((tier) => tier.id === (selectedShippingTierId || form.shippingTierId))?.description ? (
              <p className="checkout-hint">
                {shippingTiers.find((tier) => tier.id === (selectedShippingTierId || form.shippingTierId))?.description}
              </p>
            ) : null}
            <label>
              Payment method
              <select
                value={form.paymentMethod}
                onChange={(event) => onFieldChange("paymentMethod", event.target.value)}
                disabled={isSubmitting}
              >
                <option value="card">Paystack Card Payment</option>
                <option value="transfer">Paystack Bank Transfer</option>
              </select>
            </label>
            <p className="checkout-hint">
              Payment is processed securely by Paystack. Use card or transfer to complete your order.
            </p>

            {checkoutError ? <p className="form-error">{checkoutError}</p> : null}
            {checkoutNotice ? <p className="form-success">{checkoutNotice}</p> : null}

            <button type="submit" className="primary-action" disabled={items.length === 0 || isSubmitting}>
              {isSubmitting ? "Processing..." : "Pay Securely"}
            </button>
          </form>

          <div className="checkout-summary">
            <h3>Order Summary</h3>
            <ul>
              {items.map((item) => (
                <li key={item.product.id}>
                  <span className="checkout-item-meta">
                    <span>
                      {item.product.name} x {item.quantity}
                    </span>
                    {normalizeAvailability(item.product.availability) === "preorder" ? (
                      <small className="preorder-note">{resolvePreorderNote(item)}</small>
                    ) : null}
                  </span>
                  <strong>{toPrice(item.lineTotal)}</strong>
                </li>
              ))}
            </ul>
            <p>
              Items <strong>{toPrice(subtotal)}</strong>
            </p>
            <p>
              Shipping <strong>{toPrice(shippingFee)}</strong>
            </p>
            <p>
              Total <strong>{toPrice(total)}</strong>
            </p>
            <p className="checkout-shipping-note">
              Shipping is included in the payment total.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutModal;
