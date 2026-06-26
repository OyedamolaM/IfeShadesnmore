import { useState } from "react";
import { toPrice } from "../../utils/format";
import { FiEdit2 } from "react-icons/fi";

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
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showShippingOptions, setShowShippingOptions] = useState(false);
  if (!open) return null;
  const selectedShippingTier = shippingTiers.find((tier) => tier.id === (selectedShippingTierId || form.shippingTierId));
  const deliveryAddress = form.address && form.city ? `${form.address}, ${form.city}` : "";
  const shippingArea = selectedShippingTier?.name || "";

  return (
    <div className="commerce-overlay checkout-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div className="checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout" onClick={(event) => event.stopPropagation()}>
        <div className="checkout-header">
          <h3>Checkout</h3>
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
          <div className="checkout-summary checkout-main-summary">
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
              Subtotal <strong>{toPrice(subtotal)}</strong>
            </p>
            <p>
              Shipping <strong>{toPrice(shippingFee)}</strong>
            </p>
            <p>
              Total <strong>{toPrice(total)}</strong>
            </p>
          </div>

          <form className="checkout-form checkout-payment-panel" onSubmit={onSubmit}>
            <section className="checkout-delivery-card">
              <div className="delivery-card-header">
                <h3>Delivery Details</h3>

                <button
                  type="button"
                  className="delivery-edit-button"
                  onClick={() => setShowDeliveryModal(true)}
                  aria-label="Edit delivery details"
                  disabled={isSubmitting}
                >
                  <FiEdit2 />
                </button>
              </div>

  {deliveryAddress || shippingArea ? (
    <>
      <p className="delivery-address">
        <strong>Address:</strong> {deliveryAddress}
      </p>

      <p className="shipping-option">
        <strong>Shipping Area:</strong> {shippingArea}
      </p>
    </>
  ) : (
    <span>Add delivery details before payment.</span>
  )}

  {checkoutError ? <p className="form-error">{checkoutError}</p> : null}
  {checkoutNotice ? <p className="form-success">{checkoutNotice}</p> : null}
</section>

            <button type="submit" className="primary-action" disabled={items.length === 0 || isSubmitting}>
              {isSubmitting ? "Paystack Loading..." : "Pay Now"}
            </button>
          </form>
        </div>

        {showDeliveryModal ? (
          <div className="checkout-delivery-overlay" onClick={() => !isSubmitting && setShowDeliveryModal(false)}>
            <form
              className="checkout-delivery-modal checkout-form"
              onSubmit={(event) => {
                event.preventDefault();
                setShowDeliveryModal(false);
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="checkout-header">
                <h2>Delivery Details</h2>
                <button
                  type="button"
                  className="close-x"
                  onClick={() => setShowDeliveryModal(false)}
                  aria-label="Close delivery details"
                  disabled={isSubmitting}
                >
                  x
                </button>
              </div>
              <div className="checkout-delivery-fields">
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
            <fieldset className="checkout-shipping-options">
              <legend>Shipping</legend>
              {shippingTiers.length === 0 ? (
                <p className="checkout-hint">No shipping options are currently available.</p>
              ) : (
                <div className="checkout-shipping-picker">
                  <button
                    type="button"
                    className="checkout-shipping-trigger"
                    onClick={() => setShowShippingOptions((current) => !current)}
                    disabled={isSubmitting}
                    aria-expanded={showShippingOptions}
                  >
                    <span>{selectedShippingTier ? selectedShippingTier.name : "Select a shipping Area"}</span>
                    {selectedShippingTier ? <strong>{toPrice(selectedShippingTier.fee)}</strong> : null}
                  </button>
                  {showShippingOptions ? (
                    <div className="checkout-shipping-menu">
                      <button
                        type="button"
                        className={!selectedShippingTier ? "is-selected" : ""}
                        onClick={() => {
                          onFieldChange("shippingTierId", "");
                          setShowShippingOptions(false);
                        }}
                        disabled={isSubmitting}
                      >
                        <span>Select a shipping area</span>
                      </button>
                      {shippingTiers.map((tier) => {
                        const isSelected = String(selectedShippingTierId || form.shippingTierId || "") === String(tier.id);
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            className={isSelected ? "is-selected" : ""}
                            onClick={() => {
                              onFieldChange("shippingTierId", tier.id);
                              setShowShippingOptions(false);
                            }}
                            disabled={isSubmitting}
                          >
                            <span>{tier.name}</span>
                            <strong>{toPrice(tier.fee)}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </fieldset>
            {shippingTiers.find((tier) => tier.id === (selectedShippingTierId || form.shippingTierId))?.description ? (
              <p className="checkout-hint">
                {shippingTiers.find((tier) => tier.id === (selectedShippingTierId || form.shippingTierId))?.description}
              </p>
            ) : null}

              <button type="submit" className="primary-action" disabled={isSubmitting}>
                Save Details
              </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CheckoutModal;
