import { useEffect, useState } from "react";
import ProductMedia from "./ProductMedia";
import { toPrice } from "../../utils/format";

function ProductDetailsModal({ product, onClose, onAddToCart, onBuyNow, allowOrdering = true }) {
  const [quantityInput, setQuantityInput] = useState("1");

  useEffect(() => {
    setQuantityInput("1");
  }, [product?.id]);

  if (!product) return null;

  const resolveQuantity = () => {
    const parsed = Number.parseInt(String(quantityInput || "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };
  const nextQuantity = resolveQuantity();
  const description =
    (product.description || "").trim() || "Premium frame with modern finish and lasting comfort.";

  return (
    <div
      className="commerce-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name} details`}
      onClick={onClose}
    >
      <div className="product-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="close-x" onClick={onClose} aria-label="Close product details">
          x
        </button>

        <div className="product-modal-media">
          <ProductMedia product={product} />
        </div>

        <div className="product-modal-content">
          <h2>{product.name}</h2>
          <p className="product-modal-price">{toPrice(product.price)}</p>
          <p className="product-modal-description">{description}</p>
          <ul className="product-meta-list">
            <li>Blue light filter compatible</li>
            <li>Unisex fit</li>
            <li>Free cleaning cloth included</li>
          </ul>

          {allowOrdering ? (
            <>
              <label className="quantity-control">
                Quantity
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={quantityInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (!/^\d*$/.test(nextValue)) return;
                    setQuantityInput(nextValue);
                  }}
                  onBlur={() => {
                    setQuantityInput(String(resolveQuantity()));
                  }}
                />
              </label>

              <div className="product-modal-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => onAddToCart(product, nextQuantity)}
                >
                  Add to Cart
                </button>
                <button type="button" className="primary-action" onClick={() => onBuyNow(product, nextQuantity)}>
                  Buy Now
                </button>
              </div>
            </>
          ) : (
            <p className="product-modal-readonly">Ordering is disabled in admin preview mode.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetailsModal;
