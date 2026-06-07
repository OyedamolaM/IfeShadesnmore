import { useEffect, useMemo, useState } from "react";
import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";
import { trackEvent } from "../../utils/analytics";

const MIN_SEARCH_LENGTH = 3;

const COLLECTION_CARDS = [
  {
    audience: "women",
    title: "Women's Glasses",
    ctaLabel: "Shop Women's",
    sectionId: "women-section"
  },
  {
    audience: "men",
    title: "Men's Glasses",
    ctaLabel: "Shop Men's",
    sectionId: "men-section"
  },
  {
    audience: "sunglasses",
    title: "Sunglasses",
    ctaLabel: "Shop Sunglasses",
    sectionId: "sunglasses-section"
  },
  {
    audience: "unisex",
    title: "Unisex Glasses",
    ctaLabel: "Shop Unisex",
    sectionId: "unisex-section"
  },
  {
    audience: "antiblue",
    title: "Anti Blue Light",
    ctaLabel: "Shop Anti-Blue Light",
    sectionId: "anti-blue-light-section",
  },
  {
    audience: "prescription",
    title: "Prescriptions",
    ctaLabel: "Shop Prescription",
    sectionId: "prescription-section",
    comingSoon: true
  }
];

function normalizeAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "out_of_stock" || source === "preorder" || source === "in_stock") return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function getAvailabilityLabel(value) {
  if (value === "out_of_stock") return "Out of Stock";
  if (value === "preorder") return "Preorder";
  return "In Stock";
}

function normalizeAudienceKey(value) {
  const source = String(value || "").trim().toLowerCase();
  const compact = source.replace(/[^a-z]/g, "");
  if (!compact) return "unisex";

  if (
    compact.includes("women") ||
    compact.includes("woman") ||
    compact.includes("female") ||
    compact.includes("lady")
  ) {
    return "women";
  }

  if (
    compact === "men" ||
    compact === "man" ||
    compact.includes("male") ||
    compact.includes("gent")
  ) {
    return "men";
  }

  if (compact.includes("sunglass") || compact.includes("shades")) {
    return "sunglasses";
  }

  if (
    compact.includes("antiblue") ||
    compact.includes("bluelight") ||
    compact.includes("antiglare")
  ) {
    return "antiblue";
  }

  if (compact.includes("prescrip") || compact.includes("prescription") || compact === "rx") {
    return "prescrip";
  }

  if (compact.includes("unisex")) return "unisex";
  return "unisex";
}

function inferAudienceFromName(name) {
  const value = String(name || "").toLowerCase();
  if (/\b(women|woman|lady|female|girls?)\b/.test(value)) return "women";
  if (/\b(men|man|male|gent|boys?)\b/.test(value)) return "men";
  if (/\b(sunglass|sunglasses|shades?)\b/.test(value)) return "sunglasses";
  if (/(anti[\s-]?blue|blue[\s-]?light|anti[\s-]?glare)/.test(value)) return "antiblue";
  if (/\b(prescrip|prescription|rx)\b/.test(value)) return "prescrip";
  return "unisex";
}

function resolveAudiences(product) {
  const explicitList = Array.isArray(product?.audiences) ? product.audiences : [];
  const fallback = String(product?.audience || "").trim();
  const merged = explicitList.length > 0 ? explicitList : fallback ? [fallback] : [];
  const normalized = [...new Set(merged.map((entry) => normalizeAudienceKey(entry)).filter(Boolean))];
  if (normalized.length > 0) return normalized;
  return [inferAudienceFromName(product?.name)];
}

function matchesQuery(product, query) {
  if (!query) return true;
  const audienceText = Array.isArray(product?.audiences)
    ? product.audiences.join(" ")
    : product?.audience || "";
  const haystack =
    `${product.id || ""} ${product.name || ""} ${product.description || ""} ${product.ctaLabel || ""} ${
      audienceText
    } ${product.variant || ""} ${product.section || ""} ${product.price || ""}`.toLowerCase();
  return haystack.includes(query);
}

function canDisplayOnStorefront(product) {
  return normalizeAvailability(product?.availability) !== "out_of_stock";
}

function groupProductsByAudience(items) {
  const grouped = COLLECTION_CARDS.reduce((acc, card) => {
    acc[card.audience] = [];
    return acc;
  }, {});

  (items || []).forEach((product) => {
    const audiences = resolveAudiences(product);
    let pushed = false;

    audiences.forEach((audience) => {
      if (!grouped[audience]) return;
      if (!grouped[audience].some((entry) => entry.id === product.id)) {
        grouped[audience].push(product);
      }
      pushed = true;
    });

    if (!pushed && !grouped.unisex.some((entry) => entry.id === product.id)) {
      grouped.unisex.push(product);
    }
  });

  return grouped;
}

function ArrivalsSection({
  products,
  searchQuery,
  onSearchChange,
  onViewProduct,
  onAddToCart,
  onAddToWishlist,
  wishlistPendingProductId = "",
  allowOrdering = true,
  themeVariant = "v1"
}) {
  const [expandedSections, setExpandedSections] = useState({});
  const [openProductActionsId, setOpenProductActionsId] = useState("");
  const [isMobileView, setIsMobileView] = useState(false);
  const rawQuery = String(searchQuery || "").trim().toLowerCase();
  const query = rawQuery.length >= MIN_SEARCH_LENGTH ? rawQuery : "";
  const isSearching = query.length > 0;
  const isSearchTooShort = rawQuery.length > 0 && rawQuery.length < MIN_SEARCH_LENGTH;
  const collapsedItemCount = isMobileView ? 3 : 4;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleChange = (event) => setIsMobileView(event.matches);
    setIsMobileView(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    trackEvent("view_shop_collection_section", {
      section_name: "shop_collection"
    });
  }, []);

  const visibleProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products
      .filter((product) => canDisplayOnStorefront(product))
      .filter((product) => matchesQuery(product, query));
  }, [products, query]);

  const allProductsByAudience = useMemo(
    () => groupProductsByAudience((products || []).filter((product) => canDisplayOnStorefront(product))),
    [products]
  );
  const visibleProductsByAudience = useMemo(
    () => groupProductsByAudience(visibleProducts),
    [visibleProducts]
  );

  const sortedCollectionCards = useMemo(() => {
    return [...COLLECTION_CARDS]
      .sort((cardA, cardB) => {
        const aHasProducts = (allProductsByAudience[cardA.audience] || []).length > 0;
        const bHasProducts = (allProductsByAudience[cardB.audience] || []).length > 0;
        if (aHasProducts === bHasProducts) return 0;
        return bHasProducts ? 1 : -1;
      });
  }, [allProductsByAudience]);

  const visibleCollectionCards = useMemo(() => {
    if (!isSearching) {
      return sortedCollectionCards.filter((card) => (allProductsByAudience[card.audience] || []).length > 0);
    }
    return sortedCollectionCards.filter((card) => (visibleProductsByAudience[card.audience] || []).length > 0);
  }, [allProductsByAudience, isSearching, sortedCollectionCards, visibleProductsByAudience]);

  const toggleSection = (audience) => {
    setExpandedSections((current) => ({ ...current, [audience]: !current[audience] }));
  };

  const toggleProductActions = (productId) => {
    setOpenProductActionsId((current) => (current === productId ? "" : productId));
  };

  return (
    <section className={`shop-sections themed-product-section themed-product-${themeVariant}`} id="shop">
      <div className="container">
        <div className="shop-toolbar">
          <input
            id="catalog-search-input"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search glasses (min 3 characters)..."
          />
        </div>
        {isSearchTooShort ? (
          <p className="search-hint">Type at least {MIN_SEARCH_LENGTH} characters to search.</p>
        ) : null}

        {visibleCollectionCards.map((card) => {
          const visibleItemsAll = visibleProductsByAudience[card.audience] || [];
          const listItems = visibleItemsAll;
          const isExpanded = Boolean(expandedSections[card.audience]);
          const visibleItems = isExpanded
            ? listItems
            : listItems.slice(0, collapsedItemCount);
          const canExpand = visibleItemsAll.length > collapsedItemCount;

          return (
            <section className="collection-block" id={card.sectionId} key={card.sectionId}>
              <div className="collection-header">
                <div className="lined-heading">
                  <span />
                  <h2>{card.title}</h2>
                  <span />
                </div>
              </div>

              {visibleItems.length > 0 ? (
                <div className="collection-grid">
                  {visibleItems.map((product, index) => {
                    const availability = normalizeAvailability(product.availability);
                    const isOutOfStock = availability === "out_of_stock";
                    const isActionsOpen = openProductActionsId === product.id;
                    return (
                      <article className={index % 2 === 1 ? "collection-card is-offset" : "collection-card"} key={product.id}>
                        <button
                          type="button"
                          className="seller-media media-button"
                          onClick={() => onViewProduct(product)}
                        >
                          <span className="themed-product-tag">
                            {getAvailabilityLabel(availability)}
                          </span>
                          <ProductMedia product={product} />
                        </button>
                        <div className="collection-card-meta">
                          <div>
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
                          </div>
                          {allowOrdering ? (
                            <div className={`collection-action-menu ${isActionsOpen ? "is-open" : ""}`}>
                              <div className="collection-action-panel" aria-hidden={!isActionsOpen}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onViewProduct(product);
                                    setOpenProductActionsId("");
                                  }}
                                >
                                  View details
                                </button>
                                <button
                                  type="button"
                                  disabled={wishlistPendingProductId === product.id}
                                  onClick={() => {
                                    onAddToWishlist?.(product);
                                    setOpenProductActionsId("");
                                  }}
                                >
                                  {wishlistPendingProductId === product.id ? "Saving..." : "Save to wishlist"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isOutOfStock}
                                  onClick={() => {
                                    if (!isOutOfStock) onAddToCart(product, 1);
                                    setOpenProductActionsId("");
                                  }}
                                >
                                  Add to cart
                                </button>
                              </div>
                              <button
                                type="button"
                                className="collection-add-button"
                                disabled={isOutOfStock}
                                aria-expanded={isActionsOpen}
                                aria-label={
                                  isOutOfStock
                                    ? `${product.name} is out of stock`
                                    : `${isActionsOpen ? "Close" : "Open"} ${product.name} actions`
                                }
                                onClick={() => {
                                  if (!isOutOfStock) toggleProductActions(product.id);
                                }}
                              >
                                <span aria-hidden="true">{isActionsOpen ? "-" : "+"}</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {canExpand ? (
                <div className="collection-footer-toggle">
                  <button
                    type="button"
                    className="section-toggle-link"
                    onClick={() => toggleSection(card.audience)}
                  >
                    {isExpanded ? "Show Less" : "View Full Products"}
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}
        {isSearching && visibleCollectionCards.length === 0 ? (
          <p className="collection-empty">No glasses matched your search.</p>
        ) : null}
      </div>
    </section>
  );
}

export default ArrivalsSection;
