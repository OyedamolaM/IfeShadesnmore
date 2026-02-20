import CartIcon from "../icons/CartIcon";
import SearchIcon from "../icons/SearchIcon";
import ProfileIcon from "../icons/ProfileIcon";

function Header({
  brandName,
  brandTagline,
  onOpenAdmin,
  cartCount,
  onOpenCart,
  onOpenProfile,
  onOpenSearch
}) {
  const normalizedCount = Math.max(0, Number(cartCount) || 0);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <button type="button" className="brand-mark" onDoubleClick={onOpenAdmin} aria-label="Open admin">
          <span className="brand-top">{brandName}</span>
          <span className="brand-bottom">{brandTagline}</span>
        </button>

        <nav aria-label="Primary navigation" className="primary-nav">
          <a className="active" href="#home">
            Home
          </a>
          <a href="#shop">Shop</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>

        <div className="header-actions">
          <button type="button" className="header-icon-button header-search" onClick={onOpenSearch} aria-label="Search products">
            <SearchIcon />
          </button>

          <button type="button" className="header-icon-button header-profile" onClick={onOpenProfile} aria-label="Open profile">
            <ProfileIcon />
          </button>

          <button type="button" className="header-icon-button header-cart" onClick={onOpenCart} aria-label="Open cart">
            <CartIcon />
            {normalizedCount > 0 ? (
              <span className="cart-count">{normalizedCount > 99 ? "99+" : normalizedCount}</span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
