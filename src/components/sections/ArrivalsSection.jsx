import { useEffect, useMemo, useState } from "react";
import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";

const CATEGORY_PLACEHOLDER_IMAGE = "/hero/UnisexGlasses.jpg";
const MIN_SEARCH_LENGTH = 3;

const SHOP_CATEGORY_CARDS = [
  {
    id: "shop-women",
    title: "Women's Glasses",
    ctaLabel: "Shop Women's",
    sectionId: "women-section",
    image: "/hero/Female-glasses.jpg",
    alt: "Women's glasses collection"
  },
  {
    id: "shop-men",
    title: "Men's Glasses",
    ctaLabel: "Shop Men's",
    sectionId: "men-section",
    image: "/hero/male-glasses.jpg",
    alt: "Men's glasses collection"
  },
  {
    id: "shop-sunglasses",
    title: "Sunglasses",
    ctaLabel: "Shop Sunglasses",
    sectionId: "sunglasses-section",
    image: "/hero/Sunglasses.jpg",
    alt: "Sunglasses collection"
  },
  {
    id: "shop-unisex",
    title: "Unisex Glasses",
    ctaLabel: "Shop Unisex",
    sectionId: "unisex-section",
    image: "/hero/UnisexGlasses.jpg",
    alt: "Unisex glasses collection"
  },
  {
    id: "shop-antiblue",
    title: "Anti Blue Light",
    ctaLabel: "Shop Anti-Blue Light",
    sectionId: "anti-blue-light-section",
    image: "/hero/Antiblueglasses.jpg",
    alt: "Anti-blue and anti-glare glasses collection"
  },
  {
    id: "shop-prescription",
    title: "Prescriptions",
    ctaLabel: "Shop Prescription",
    sectionId: "prescription-section",
    image: "/hero/Prescriptionlenses.jpg",
    alt: "Prescription glasses collection"
  }
];

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
    comingSoon: true
  },
  {
    audience: "prescrip",
    title: "Prescriptions",
    ctaLabel: "Shop Prescription",
    sectionId: "prescription-section",
    comingSoon: true
  }
];

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

function resolveAudience(product) {
  const explicitRaw = String(product?.audience || "").trim();
  if (!explicitRaw) return inferAudienceFromName(product?.name);
  return normalizeAudienceKey(explicitRaw);
}

function matchesQuery(product, query) {
  if (!query) return true;
  const haystack =
    `${product.id || ""} ${product.name || ""} ${product.description || ""} ${product.ctaLabel || ""} ${
      product.audience || ""
    } ${product.variant || ""} ${product.section || ""} ${product.price || ""}`.toLowerCase();
  return haystack.includes(query);
}

function scrollToSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function groupProductsByAudience(items) {
  const grouped = COLLECTION_CARDS.reduce((acc, card) => {
    acc[card.audience] = [];
    return acc;
  }, {});

  (items || []).forEach((product) => {
    const audience = resolveAudience(product);
    if (!grouped[audience]) {
      grouped.unisex.push(product);
      return;
    }
    grouped[audience].push(product);
  });

  return grouped;
}

function ArrivalsSection({
  products,
  searchQuery,
  onSearchChange,
  onViewProduct,
  onAddToCart,
  allowOrdering = true
}) {
  const [expandedSections, setExpandedSections] = useState({});
  const [categoryInfoNotice, setCategoryInfoNotice] = useState({ id: "", message: "" });
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });
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

  const visibleProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((product) => matchesQuery(product, query));
  }, [products, query]);

  const allProductsByAudience = useMemo(() => groupProductsByAudience(products), [products]);
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

  const categoryCards = useMemo(() => {
    const bySectionId = COLLECTION_CARDS.reduce((acc, card) => {
      acc[card.sectionId] = card;
      return acc;
    }, {});

    return SHOP_CATEGORY_CARDS.map((card) => {
      const linkedCollection = bySectionId[card.sectionId];
      const audience = linkedCollection?.audience;
      const productCount = audience ? (allProductsByAudience[audience] || []).length : 0;
      const comingSoon = Boolean(linkedCollection?.comingSoon);
      const isAvailable = productCount > 0;
      return {
        ...card,
        isAvailable,
        comingSoon
      };
    });
  }, [allProductsByAudience]);

  useEffect(() => {
    if (!categoryInfoNotice.id) return undefined;
    const timer = window.setTimeout(() => {
      setCategoryInfoNotice({ id: "", message: "" });
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [categoryInfoNotice]);

  const toggleSection = (audience) => {
    setExpandedSections((current) => ({ ...current, [audience]: !current[audience] }));
  };

  const onCategoryCardAction = (card) => {
    if (card.isAvailable) {
      scrollToSection(card.sectionId);
      return;
    }

    if (card.comingSoon) {
      setCategoryInfoNotice({
        id: card.id,
        message: "Product not yet arrived, but your lens can be converted for a service fee."
      });
      return;
    }

    setCategoryInfoNotice({
      id: card.id,
      message: "Products are being restocked. Please check back soon."
    });
  };

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
            placeholder="Search glasses (min 3 characters)..."
          />
        </div>
        {isSearchTooShort ? (
          <p className="search-hint">Type at least {MIN_SEARCH_LENGTH} characters to search.</p>
        ) : null}

        {!isSearching ? (
          <div className="category-grid">
            {categoryCards.map((card, index) => {
              const aboveTheFoldCount = isMobileView ? 3 : 4;
              const isHighPriority = index < aboveTheFoldCount;
              return (
                <article className="category-card" key={card.id}>
                  <h3>
                    <button
                      type="button"
                      className="product-name-button"
                      onClick={() => onCategoryCardAction(card)}
                    >
                      {card.title}
                    </button>
                  </h3>
                  <button
                    type="button"
                    className="category-media media-button"
                    onClick={() => onCategoryCardAction(card)}
                  >
                    <img
                      src={card.image}
                      alt={card.alt}
                      loading={isHighPriority ? "eager" : "lazy"}
                      fetchPriority={isHighPriority ? "high" : "low"}
                      decoding="async"
                      onError={(event) => {
                        if (event.currentTarget.src.endsWith(CATEGORY_PLACEHOLDER_IMAGE)) return;
                        event.currentTarget.src = CATEGORY_PLACEHOLDER_IMAGE;
                      }}
                    />
                  </button>
                  <div className="product-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => onCategoryCardAction(card)}
                    >
                      {card.isAvailable
                        ? card.ctaLabel
                        : card.comingSoon
                        ? "Coming Soon"
                        : card.ctaLabel}
                    </button>
                  </div>
                  {categoryInfoNotice.id === card.id ? (
                    <p className="category-info-note">{categoryInfoNotice.message}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
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
                  {visibleItems.map((product) => {
                    return (
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
                          {allowOrdering ? (
                            <button
                              type="button"
                              className="primary-action"
                              onClick={() => onAddToCart(product, 1)}
                            >
                              Add to Cart
                            </button>
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
