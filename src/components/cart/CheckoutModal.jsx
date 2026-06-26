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
  const [showValidation, setShowValidation] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(form);
  console.log("shippingTiers:", shippingTiers);

  if (!open) return null;

  const selectedDraftShippingTier = shippingTiers.find(
    (tier) =>
      String(tier.id) === String(deliveryForm.shippingTierId)
  );
  const selectedShippingTier = shippingTiers.find((tier) => tier.id === (selectedShippingTierId || form.shippingTierId));
  const isDraftPickup =
  selectedDraftShippingTier?.type === "pickup" ||
  selectedDraftShippingTier?.isPickup === true;

const isPickup =
  selectedShippingTier?.type === "pickup" ||
  selectedShippingTier?.isPickup === true;
  const deliveryAddress = form.address?.trim();
  const shippingArea = selectedShippingTier?.name || "";

  const errors = {};

  if (!deliveryForm.firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!deliveryForm.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (!isDraftPickup) {
    if (!deliveryForm.address.trim()) {
      errors.address = "Shipping address is required.";
    }

    if (!deliveryForm.city.trim()) {
      errors.city = "City is required.";
    }
  }

  if (!deliveryForm.shippingTierId) {
    errors.shippingTierId = "Please select a shipping area.";
  }

  if (
    !deliveryForm.phone.trim() &&
    !deliveryForm.email.trim()
  ) {
    errors.contact =
      "Provide either a phone number or email address.";
  }
 const handleSaveDetails = (event) => {
  event.preventDefault();

  setShowValidation(true);

  if (Object.keys(errors).length > 0) {
    return;
  }

  Object.entries(deliveryForm).forEach(([key, value]) => {
    onFieldChange(key, value);
  });

  setShowDeliveryModal(false);
};

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
                  onClick={() => {
                    setShowValidation(false);
                    setShowDeliveryModal(true);
                    setDeliveryForm({...form});
                  }}
                  aria-label="Edit delivery details"
                  disabled={isSubmitting}
                >
                  <FiEdit2 />
                </button>
              </div>

              {!deliveryAddress && !shippingArea ? (
                <span>Add delivery details before payment.</span>
              ) : (
                <>
                  {!isPickup && (
                    <p className="delivery-address">
                      <strong>Address:</strong>{" "}
                      {deliveryAddress ? (
                        <>
                          {deliveryAddress}
                          {form.city ? `, ${form.city}` : null}
                        </>
                      ) : (
                        <span className="delivery-missing">Not provided</span>
                      )}
                    </p>
                  )}

                  <div className="shipping-option">

                    {isPickup && (
                      <p className="pickup-note">
                        <strong>Collection:</strong> Pickup from the selected location.
                      </p>
                    )}
                    <p>
                      <strong>Shipping Area:</strong>{" "}
                      {shippingArea ? (
                        <>
                          {shippingArea}
                          {selectedShippingTier && (
                            <small className="shipping-fee">
                              {toPrice(selectedShippingTier.fee)}
                            </small>
                          )}
                        </>
                      ) : (
                        <span className="delivery-missing">Not selected</span>
                      )}
                    </p>
                  </div>
                </>
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
              onSubmit={handleSaveDetails}
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
                      value={deliveryForm.firstName}
                      onChange={(event) =>
                        setDeliveryForm((prev) => ({
                          ...prev,
                          firstName: event.target.value,
                        }))
                      }
                      placeholder="First name"
                      disabled={isSubmitting}
                    />
                    {showValidation && errors.firstName && (
                      <p className="field-error">{errors.firstName}</p>
                    )}
                  </label>
                  <label>
                    <span>
                      Last name <span className="required-mark">*</span>
                    </span>
                    <input
                      value={deliveryForm.lastName}
                      onChange={(event) =>
                        setDeliveryForm((prev) => ({
                          ...prev,
                          lastName: event.target.value,
                        }))
                      }
                      placeholder="Last name"
                      disabled={isSubmitting}
                    />
                    {showValidation && errors.lastName && (
                      <p className="field-error">{errors.lastName}</p>
                    )}
                  </label>
                </div>

                <label>
                  Email
                  <input
                    type="email"
                    value={deliveryForm.email}
                    onChange={(event) =>
                      setDeliveryForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    placeholder="customer@email.com"
                    disabled={isSubmitting}
                  />
                  {showValidation && errors.contact && (
                    <p className="field-error">{errors.contact}</p>
                  )}
                </label>

                <label>
                  Phone number
                  <input
                    value={deliveryForm.phone}
                    onChange={(event) =>
                      setDeliveryForm((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="+234..."
                    disabled={isSubmitting}
                  />
                  {showValidation && errors.contact && (
                    <p className="field-error">{errors.contact}</p>
                  )}
                </label>

                {savedAddresses.length > 0 ? (
                  <label>
                    Saved address
                    <select
                      value={deliveryForm.addressId || ""}
                      onChange={(event) =>
                        setDeliveryForm((prev) => ({
                          ...prev,
                          addressId: event.target.value,
                        }))
                      }
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

                {!isDraftPickup && (
                  <label>
                    <span>
                      Shipping address <span className="required-mark">*</span>
                    </span>
                    <input
                      value={deliveryForm.address}
                      onChange={(event) =>
                        setDeliveryForm((prev) => ({
                          ...prev,
                          address: event.target.value,
                        }))
                      }
                      placeholder="Street and area"
                      disabled={isSubmitting}
                    />
                    {showValidation && errors.address && (
                      <p className="field-error">{errors.address}</p>
                    )}
                  </label>
                )}

                {!isDraftPickup && (
                  <label>
                    <span>
                      City <span className="required-mark">*</span>
                    </span>
                    <input
                    value={deliveryForm.city}
                    onChange={(event) =>
                      setDeliveryForm((prev) => ({
                        ...prev,
                        city: event.target.value,
                      }))
                    }
                    placeholder="City"
                    disabled={isSubmitting}
                  />
                  {showValidation && errors.city && (
                    <p className="field-error">{errors.city}</p>
                  )}
                </label>
                )}

               <fieldset className="checkout-shipping-options">
                  <legend>Shipping</legend>

                  {shippingTiers.length === 0 ? (
                    <p className="checkout-hint">
                      No shipping options are currently available.
                    </p>
                  ) : (
                    <div className="checkout-shipping-picker">
                      <button
                        type="button"
                        className="checkout-shipping-trigger"
                        onClick={() => setShowShippingOptions((current) => !current)}
                        disabled={isSubmitting}
                        aria-expanded={showShippingOptions}
                      >
                        <span>
                          {selectedDraftShippingTier
                            ? selectedDraftShippingTier.name
                            : "Select a shipping area"}
                        </span>

                        {selectedDraftShippingTier ? (
                          <strong>{toPrice(selectedDraftShippingTier.fee)}</strong>
                        ) : null}
                      </button>

                      {showShippingOptions ? (
                        <div className="checkout-shipping-menu">
                          <button
                            type="button"
                            className={!selectedDraftShippingTier ? "is-selected" : ""}
                            onClick={() => {
                              const isPickupOption =
                                tier.type === "pickup" ||
                                tier.isPickup === true;

                              setDeliveryForm((prev) => ({
                                ...prev,
                                shippingTierId: tier.id,
                                ...(isPickupOption
                                  ? {
                                      address: "",
                                      city: "",
                                      addressId: "",
                                    }
                                  : {}),
                              }));
                              setShowShippingOptions(false);
                            }}
                            disabled={isSubmitting}
                          >
                            <span>Select a shipping area</span>
                          </button>

                          {shippingTiers.map((tier) => {
                            const isSelected =
                              String(deliveryForm.shippingTierId || "") ===
                              String(tier.id);

                            return (
                              <button
                                key={tier.id}
                                type="button"
                                className={isSelected ? "is-selected" : ""}
                                onClick={() => {
                                  setDeliveryForm((prev) => ({
                                    ...prev,
                                    shippingTierId: tier.id,
                                  }));

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

                {showValidation && errors.shippingTierId && (
                  <p className="field-error">{errors.shippingTierId}</p>
                )}

                {selectedDraftShippingTier?.description && (
                  <p className="checkout-hint">
                    {selectedDraftShippingTier.description}
                  </p>
                )}

                <button
                  type="submit"
                  className="primary-action"
                  disabled={isSubmitting}
                >
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
