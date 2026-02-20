import { useEffect, useState } from "react";
import ProductMedia from "./ProductMedia";
import { toPrice } from "../../utils/format";

function ProductDetailsModal({ product, onClose, onAddToCart, onBuyNow }) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
  }, [product?.id]);

  if (!product) return null;

  const nextQuantity = Math.max(1, Number(quantity) || 1);
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

          <label className="quantity-control">
            Quantity
            <input
              type="number"
              min="1"
              value={nextQuantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <div className="product-modal-actions">
            <button type="button" className="secondary-action" onClick={() => onAddToCart(product, nextQuantity)}>
              Add to Cart
            </button>
            <button type="button" className="primary-action" onClick={() => onBuyNow(product, nextQuantity)}>
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailsModal;
