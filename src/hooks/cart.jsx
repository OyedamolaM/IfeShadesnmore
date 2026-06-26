import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CART_STORAGE_KEY } from "../constants/storefront";

const CartContext = createContext(null);

/**
 * Helpers
 */
function parseStoredCart(rawValue) {
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

function persistCart(cart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
  if (typeof window === "undefined") return;

  const stored = parseStoredCart(
    window.localStorage.getItem(CART_STORAGE_KEY) || "[]"
  );

  setCart(stored);
  setHydrated(true);
}, []);
  /**
   * Persist cart
   */
  useEffect(() => {
  if (!hydrated) return;

  persistCart(cart);
}, [cart, hydrated]);

  /**
   * Add item to cart
   */
  const addToCart = (productId, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);

    setCart((current) => {
      const index = current.findIndex((i) => i.productId === productId);

      if (index === -1) {
        return [...current, { productId, quantity: qty }];
      }

      return current.map((item, idx) =>
        idx === index
          ? { ...item, quantity: item.quantity + qty }
          : item
      );
    });
  };

  /**
   * Set exact quantity
   */
  const setCartQuantity = (productId, nextQuantity) => {
    const quantity = Math.max(0, Number(nextQuantity) || 0);

    setCart((current) => {
      const index = current.findIndex((i) => i.productId === productId);

      if (index === -1 && quantity > 0) {
        return [...current, { productId, quantity }];
      }

      if (quantity <= 0) {
        return current.filter((i) => i.productId !== productId);
      }

      return current.map((item, idx) =>
        idx === index ? { ...item, quantity } : item
      );
    });
  };

  /**
   * Remove item completely
   */
  const removeFromCart = (productId) => {
    setCart((current) =>
      current.filter((item) => item.productId !== productId)
    );
  };

  /**
   * Clear cart
   */
  const replaceCart = (nextCart) => {
  setCart(nextCart);
};
  const clearCart = () => setCart([]);

  /**
   * Derived: total item count (sum of quantities)
   */
 const cartCount = useMemo(() => {
  return cart.length;
}, [cart]);

  const value = {
    cart,
    replaceCart,
    addToCart,
    setCartQuantity,
    removeFromCart,
    clearCart,
    cartCount
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}