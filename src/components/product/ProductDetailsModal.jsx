import { useEffect, useState } from "react";
import ProductMedia from "./ProductMedia";
import { toPrice } from "../../utils/format";
import { DEFAULT_PRODUCT_DETAIL_BULLETS } from "../../constants/storefront";

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "out_of_stock" || source === "preorder" || source === "in_stock") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function ProductDetailsModal({ product, onClose, onAddToCart, onAddToWishlist, isSavingWishlist = false, onBuyNow, allowOrdering = true }) {
  const [quantityInput, setQuantityInput] = useState("1");
  const [showPreorderInfo, setShowPreorderInfo] = useState(false);

  useEffect(() => {
    setQuantityInput("1");
    setShowPreorderInfo(false);
  }, [product?.id]);

  if (!product) return null;

  const resolveQuantity = () => {
    const parsed = Number.parseInt(String(quantityInput || "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };
  const nextQuantity = resolveQuantity();
  const description =
    (product.description || "").trim() || "Premium frame with modern finish and lasting comfort.";
  const detailBullets = (Array.isArray(product.detailBullets) ? product.detailBullets : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const resolvedDetailBullets =
    detailBullets.length > 0 ? detailBullets : DEFAULT_PRODUCT_DETAIL_BULLETS;
  const availability = normalizeAvailability(product.availability);
  const isOutOfStock = availability === "out_of_stock";
  const isPreorder = availability === "preorder";
  const preorderInfoText =
    (product.preorderNote || "").trim() || "This product is available on preorder and ships when stock arrives.";
  const availabilityLabel =
    availability === "out_of_stock" ? "Out of Stock" : availability === "preorder" ? "Preorder" : "In Stock";

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
          <div className="product-availability-row">
            <span className={`availability-pill availability-${availability}`}>{availabilityLabel}</span>
            {isPreorder ? (
              <button
                type="button"
                className="preorder-info-trigger"
                onClick={() => setShowPreorderInfo((current) => !current)}
                aria-label="Toggle preorder information"
                aria-expanded={showPreorderInfo}
                aria-controls={`preorder-info-${product.id || "product"}`}
              />
            ) : null}
          </div>
          {isPreorder && showPreorderInfo ? (
            <p className="preorder-info-panel" id={`preorder-info-${product.id || "product"}`}>
              {preorderInfoText}
            </p>
          ) : null}
          <p className="product-modal-description">{description}</p>
          <ul className="product-meta-list">
            {resolvedDetailBullets.map((item, index) => (
              <li key={`${product.id || "product"}-detail-bullet-${index}`}>{item}</li>
            ))}
          </ul>

          {allowOrdering ? (
            <>
              {!isOutOfStock ? (
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
                      onClick={() => onAddToWishlist?.(product)}
                      disabled={isSavingWishlist}
                    >
                      {isSavingWishlist ? "Saving..." : "Save to Wishlist"}
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onAddToCart(product, nextQuantity)}
                    >
                      {isPreorder ? "Add Preorder" : "Add to Cart"}
                    </button>
                    <button type="button" className="primary-action" onClick={() => onBuyNow(product, nextQuantity)}>
                      {isPreorder ? "Preorder Now" : "Buy Now"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="product-modal-readonly">This product is currently out of stock.</p>
              )}
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
