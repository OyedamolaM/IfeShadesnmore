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

function productSlugId(product) {
  const slug =
    String(product?.name || product?.id || "product")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "product";
  return `${slug}--${encodeURIComponent(product.id)}`;
}

function getProductUrl(product) {
  const path = `/products/${productSlugId(product)}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18 8a3 3 0 1 0-2.82-4H15a3 3 0 0 0 .62 1.82L8.9 9.2a3 3 0 1 0 0 5.6l6.72 3.38A3 3 0 1 0 17 16a3 3 0 0 0-1.82.62L8.46 13.2a3.1 3.1 0 0 0 0-2.4l6.72-3.38A3 3 0 0 0 18 8Z" />
    </svg>
  );
}

function ProductDetailsModal({ product, onClose, onAddToCart, onAddToWishlist, isSavingWishlist = false, onBuyNow, allowOrdering = true }) {
  const [quantityInput, setQuantityInput] = useState("1");
  const [showPreorderInfo, setShowPreorderInfo] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    setQuantityInput("1");
    setShowPreorderInfo(false);
    setShareStatus("");
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
  const productUrl = getProductUrl(product);

  const handleShareProduct = async () => {
    const shareData = {
      title: product.name || "IfeShadesnMore product",
      text: product.name ? `View ${product.name} on IfeShadesnMore` : "View this product on IfeShadesnMore",
      url: productUrl
    };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(shareData);
        setShareStatus("Shared.");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(productUrl);
        setShareStatus("Product link copied.");
        return;
      }
      setShareStatus(productUrl);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setShareStatus("Could not share. Copy the product page link from your browser.");
    }
  };

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
          <div className="product-modal-heading">
            <h2>{product.name}</h2>
          </div>
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
                    <button
                      type="button"
                      className="secondary-action detail-cart-button"
                      onClick={() => onAddToCart(product, nextQuantity)}
                    >
                      {isPreorder ? "Add Preorder" : "Add to Cart"}
                    </button>
                  </label>

                  <div className="product-modal-actions">
                    <button
                      type="button"
                      className="secondary-action product-action-share"
                      onClick={handleShareProduct}
                    >
                      <ShareIcon />
                      Share
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onAddToWishlist?.(product)}
                      disabled={isSavingWishlist}
                    >
                      {isSavingWishlist ? "Saving..." : "Save to Wishlist"}
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
