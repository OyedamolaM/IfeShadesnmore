import ProductMedia from "../product/ProductMedia";
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

function CartDrawer({
  open,
  onClose,
  items,
  subtotal,
  onDecrement,
  onIncrement,
  onRemove,
  onOpenCheckout
}) {
  if (!open) return null;

  return (
    <div className="commerce-overlay cart-overlay" onClick={onClose}>
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cart-header">
          <h2>Your Cart</h2>
          <button type="button" className="close-x" onClick={onClose} aria-label="Close cart">
            x
          </button>
        </div>

        <div className="cart-body">
          {items.length === 0 ? (
            <p className="empty-note">Your cart is empty. Add products to continue.</p>
          ) : (
            <ul className="cart-list">
              {items.map((item) => (
                <li key={item.product.id}>
                  <div className="cart-item-media">
                    <ProductMedia product={item.product} />
                  </div>
                  <div className="cart-item-meta">
                    <h3>{item.product.name}</h3>
                    <p>{toPrice(item.product.price)}</p>
                    {normalizeAvailability(item.product.availability) === "preorder" ? (
                      <p className="preorder-note">{resolvePreorderNote(item)}</p>
                    ) : null}
                    <div className="quantity-stepper">
                      <button type="button" onClick={() => onDecrement(item.product.id)}>
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => onIncrement(item.product.id)}>
                        +
                      </button>
                    </div>
                    <button type="button" className="remove-link" onClick={() => onRemove(item.product.id)}>
                      Remove
                    </button>
                  </div>
                  <strong>{toPrice(item.lineTotal)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cart-footer">
          <p>
            Subtotal <strong>{toPrice(subtotal)}</strong>
          </p>
          <p className="cart-shipping-note">Shipping fee is selected and added during checkout.</p>
          <button type="button" className="primary-action" disabled={items.length === 0} onClick={onOpenCheckout}>
            Proceed to Checkout
          </button>
        </div>
      </aside>
    </div>
  );
}

export default CartDrawer;
