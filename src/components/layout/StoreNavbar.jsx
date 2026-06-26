import CartIcon from "../icons/CartIcon";
import ProfileIcon from "../icons/ProfileIcon";
import PreviewStyleSwitcher from "../preview/PreviewStyleSwitcher";
import { Link } from "@tanstack/react-router";

export default function StoreNavbar({
  brandName = "IfeShadesnMore",
  cartCount = 0,
  currentUser,
  styleVariant,
  onStyleVariantChange,
  onOpenCart,
  onOpenProfile,
  onOpenAdmin,
  showAdmin = false,
  primaryShopTargetId = "shop"
}) {
  const normalizedCount = Math.max(0, Number(cartCount) || 0);

  return (
    <header className="preview-nav product-page-header">
      <Link to="/" className="preview-brand" aria-label="Home">
        <img src="/brand/ife-logo-circle.png" alt="" />
        <strong>{brandName}</strong>
      </Link>

      <nav aria-label="Primary navigation">
        <Link to="/" hash={primaryShopTargetId}>Shop</Link>
        <Link to="/" hash="editorial">Blog</Link>
        <Link to="/" hash="reviews">Reviews</Link>
        <Link to="/" hash="faq">FAQ</Link>
        <Link to="/" hash="contact">About</Link>
      </nav>

      <div className="preview-nav-actions">
        {styleVariant && onStyleVariantChange && (
          <PreviewStyleSwitcher
            value={styleVariant}
            onChange={onStyleVariantChange}
            compactLabel="Theme"
          />
        )}

        {onOpenProfile && (
          <button
            type="button"
            className="preview-account-button"
            onClick={onOpenProfile}
            aria-label="Profile"
          >
            <ProfileIcon />
          </button>
        )}

        {showAdmin && currentUser?.role === "admin" && onOpenAdmin && (
          <button
            type="button"
            className="preview-account-button"
            onClick={onOpenAdmin}
            aria-label="Admin"
          >
            Admin
          </button>
        )}

        {onOpenCart && (
          <button
            type="button"
            className="preview-cart-button"
            onClick={onOpenCart}
            aria-label="Cart"
          >
            <CartIcon />
            {normalizedCount > 0 ? (
              <span>{normalizedCount > 99 ? "99+" : normalizedCount}</span>
            ) : null}
          </button>
        )}
      </div>
    </header>
  );
}