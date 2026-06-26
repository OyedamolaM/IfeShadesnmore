import { useEffect, useMemo, useState } from "react";
import { fetchAccountDashboard, initializeCheckout } from "../utils/api";
import { buildCheckoutLoginRedirect, createCheckoutForm, splitFullName } from "../utils/cart";

export function useCheckout({ currentUser, cartItems, shippingTiers, onNavigate }) {
  const [checkoutForm, setCheckoutForm] = useState(() => createCheckoutForm(currentUser));
  const [accountAddresses, setAccountAddresses] = useState([]);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const activeShippingTiers = useMemo(
    () => (Array.isArray(shippingTiers) ? shippingTiers : []).filter((tier) => tier?.isActive !== false),
    [shippingTiers]
  );
  const selectedShippingTier = useMemo(
    () => activeShippingTiers.find((tier) => tier.id === checkoutForm.shippingTierId) || null,
    [activeShippingTiers, checkoutForm.shippingTierId]
  );
  const shippingFee = Number(selectedShippingTier?.fee) || 0;
  const cartSubtotal = (cartItems?? []).reduce((total, item) => total + item.lineTotal, 0);
  const checkoutTotal = cartSubtotal + shippingFee;

  // Keep the form prefilled with the latest known user info (e.g. after login).
  useEffect(() => {
    const nameParts = splitFullName(currentUser?.fullName || "");
    setCheckoutForm((current) => ({
      ...current,
      firstName: current.firstName || nameParts.firstName,
      lastName: current.lastName || nameParts.lastName,
      email: current.email || currentUser?.email || "",
      phone: current.phone || currentUser?.phone || "",
      address: current.address || currentUser?.address || "",
      city: current.city || currentUser?.city || ""
    }));
  }, [currentUser]);

  // Reset the submitting spinner if the user returns from Paystack (back button / tab focus).
  useEffect(() => {
    const reset = () => setIsSubmittingCheckout(false);
    const handleVisibility = () => {
      if (!document.hidden) reset();
    };
    window.addEventListener("pageshow", reset);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pageshow", reset);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const openCheckout = async () => {
    if (cartItems.length === 0) return false;
    if (!currentUser) {
      setCheckoutError("Please login first to complete checkout.");
      onNavigate(buildCheckoutLoginRedirect());
      return false;
    }

    setCheckoutError("");
    setCheckoutNotice("");
    setShowCheckout(true);

    const nameParts = splitFullName(currentUser.fullName || "");
    setCheckoutForm((current) => ({
      ...current,
      firstName: current.firstName || nameParts.firstName,
      lastName: current.lastName || nameParts.lastName,
      email: current.email || currentUser.email || "",
      phone: current.phone || currentUser.phone || "",
      address: current.address || currentUser.address || "",
      city: current.city || currentUser.city || ""
    }));

    let savedAddresses = accountAddresses;
    try {
      const accountPayload = await fetchAccountDashboard();
      savedAddresses = Array.isArray(accountPayload.addresses) ? accountPayload.addresses : [];
      setAccountAddresses(savedAddresses);
    } catch {
      savedAddresses = accountAddresses;
    }
    const defaultAddress = savedAddresses.find((address) => address.isDefault) || savedAddresses[0] || null;
    setCheckoutForm((current) => ({
      ...current,
      firstName: current.firstName || nameParts.firstName,
      lastName: current.lastName || nameParts.lastName,
      email: current.email || currentUser.email || "",
      phone: current.phone || defaultAddress?.phone || currentUser.phone || "",
      address: current.address || defaultAddress?.street || currentUser.address || "",
      city: current.city || defaultAddress?.city || currentUser.city || "",
      addressId: current.addressId || (defaultAddress?.id ? String(defaultAddress.id) : "")
    }));
    return true;
  };

  const onFieldChange = (field, value) => {
    if (field === "addressId") {
      const selectedAddress = accountAddresses.find((address) => String(address.id) === String(value));
      setCheckoutForm((current) => ({
        ...current,
        addressId: value,
        ...(selectedAddress
          ? {
              phone: selectedAddress.phone || current.phone,
              address: selectedAddress.street || current.address,
              city: selectedAddress.city || current.city
            }
          : {})
      }));
      setCheckoutError("");
      return;
    }
    setCheckoutForm((current) => ({ ...current, [field]: value }));
    setCheckoutError("");
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setCheckoutError("Please login first.");
      onNavigate(buildCheckoutLoginRedirect());
      return;
    }
    if (cartItems.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    const isPickup = selectedShippingTier?.type === "pickup";
    const required = isPickup ? ["firstName", "lastName"] : ["firstName", "lastName", "address", "city"];
    const missing = required.find((field) => !String(checkoutForm[field] || "").trim());
    if (missing) {
      setCheckoutError(isPickup ? "Please complete the required pickup details." : "Please complete all delivery fields.");
      return;
    }
    if (!String(checkoutForm.phone || "").trim() && !String(checkoutForm.email || "").trim()) {
      setCheckoutError("Phone or email is required.");
      return;
    }
    if (!checkoutForm.shippingTierId) {
      setCheckoutError("Please select a shipping area.");
      return;
    }

    setCheckoutError("");
    setCheckoutNotice("");
    setIsSubmittingCheckout(true);
    try {
      const payload = await initializeCheckout({
        items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        paymentMethod: checkoutForm.paymentMethod,
        shippingTierId: checkoutForm.shippingTierId,
        addressId: checkoutForm.addressId || undefined,
        customer: {
          firstName: checkoutForm.firstName.trim(),
          lastName: checkoutForm.lastName.trim(),
          fullName: `${checkoutForm.firstName || ""} ${checkoutForm.lastName || ""}`.trim(),
          email: checkoutForm.email.trim(),
          phone: checkoutForm.phone.trim(),
          address: checkoutForm.address.trim(),
          city: checkoutForm.city.trim()
        }
      });
      window.location.assign(payload.authorizationUrl);
    } catch (requestError) {
      setCheckoutError(requestError.message || "Could not initialize payment.");
      setCheckoutNotice("");
      setIsSubmittingCheckout(false);
    }
  };

  return {
    checkoutForm,
    setCheckoutForm,
    accountAddresses,
    activeShippingTiers,
    selectedShippingTier,
    shippingFee,
    checkoutTotal,
    showCheckout,
    setShowCheckout,
    checkoutError,
    setCheckoutError,
    checkoutNotice,
    setCheckoutNotice,
    isSubmittingCheckout,
    openCheckout,
    onFieldChange,
    handleCheckoutSubmit
  };
}