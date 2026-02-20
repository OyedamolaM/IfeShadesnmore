import { useMemo } from "react";
import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";

const COLLECTION_CARDS = [
  { audience: "women", title: "Women's Glasses", ctaLabel: "Shop Women's", sectionId: "women-section" },
  { audience: "men", title: "Men's Glasses", ctaLabel: "Shop Men's", sectionId: "men-section" },
  { audience: "unisex", title: "Unisex Glasses", ctaLabel: "Shop Unisex", sectionId: "unisex-section" }
];

function inferAudienceFromName(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("women") || value.includes("lady") || value.includes("female")) return "women";
  if (value.includes("men") || value.includes("male") || value.includes("gent")) return "men";
  return "unisex";
}

function resolveAudience(product) {
  if (product?.audience === "women" || product?.audience === "men" || product?.audience === "unisex") {
    return product.audience;
  }
  return inferAudienceFromName(product?.name);
}

function matchesQuery(product, query) {
  if (!query) return true;
  const haystack = `${product.name} ${product.description || ""} ${product.ctaLabel || ""}`.toLowerCase();
  return haystack.includes(query);
}

function scrollToSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ArrivalsSection({ products, searchQuery, onSearchChange, onViewProduct, onAddToCart }) {
  const query = String(searchQuery || "").trim().toLowerCase();

  const visibleProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((product) => matchesQuery(product, query));
  }, [products, query]);

  const productsByAudience = useMemo(() => {
    const grouped = { women: [], men: [], unisex: [] };
    visibleProducts.forEach((product) => {
      grouped[resolveAudience(product)].push(product);
    });
    return grouped;
  }, [visibleProducts]);

  const allCatalogProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products;
  }, [products]);

  return (
    <section className="shop-sections" id="shop">
      <div className="container">
        <div className="shop-toolbar">
          <h2>Shop Collection</h2>
          <input
            id="catalog-search-input"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search glasses..."
          />
        </div>

        <div className="category-grid">
          {COLLECTION_CARDS.map((card) => {
            const previewProduct =
              productsByAudience[card.audience][0] ||
              allCatalogProducts.find((item) => resolveAudience(item) === card.audience) ||
              allCatalogProducts[0];

            return (
              <article className="category-card" key={card.audience}>
                <h3>
                  <button
                    type="button"
                    className="product-name-button"
                    onClick={() => scrollToSection(card.sectionId)}
                  >
                    {card.title}
                  </button>
                </h3>
                {previewProduct ? (
                  <button
                    type="button"
                    className="category-media media-button"
                    onClick={() => scrollToSection(card.sectionId)}
                  >
                    <ProductMedia product={previewProduct} />
                  </button>
                ) : (
                  <div className="category-media" />
                )}
                <div className="product-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => scrollToSection(card.sectionId)}
                  >
                    {card.ctaLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {COLLECTION_CARDS.map((card) => {
          const items = productsByAudience[card.audience];
          return (
            <section className="collection-block" id={card.sectionId} key={card.sectionId}>
              <div className="lined-heading">
                <span />
                <h2>{card.title}</h2>
                <span />
              </div>

              {items.length === 0 ? (
                <p className="collection-empty">No products in this section yet.</p>
              ) : (
                <div className="collection-grid">
                  {items.map((product) => (
                    <article className="collection-card" key={product.id}>
                      <button
                        type="button"
                        className="seller-media media-button"
                        onClick={() => onViewProduct(product)}
                      >
                        <ProductMedia product={product} />
                      </button>
                      <h3>
                        <button
                          type="button"
                          className="product-name-button"
                          onClick={() => onViewProduct(product)}
                        >
                          {product.name}
                        </button>
                      </h3>
                      <p>{toPrice(product.price)}</p>
                      <div className="product-actions">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => onViewProduct(product)}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => onAddToCart(product, 1)}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="coming-soon-section" id="coming-soon">
          <h3>Coming Soon: Anti-Blue Light (Anti-Glare) Glasses</h3>
          <p>
            We are preparing premium anti-blue light and anti-glare frames for screen users.
            Join the waitlist to get first access when they launch.
          </p>
          <button
            type="button"
            className="primary-action"
            onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Join Waitlist
          </button>
        </section>
      </div>
    </section>
  );
}

export default ArrivalsSection;
