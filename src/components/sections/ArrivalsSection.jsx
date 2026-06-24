import { useEffect, useMemo, useRef, useState } from "react";
import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";
import { trackEvent } from "../../utils/analytics";

const MIN_SEARCH_LENGTH = 3;

const COLLECTION_SECTIONS = [
  {
    title: "Plain Fashion Glasses",
    sectionId: "plain-fashion-section",
    groups: [
      { id: "fashion-women", title: "Female Fashion Glasses", gender: "women", strictFashion: true },
      { id: "fashion-men", title: "Male Fashion Glasses", gender: "men", strictFashion: true }
    ]
  },
  {
    title: "Photochromic Glasses",
    sectionId: "photochromic-section",
    groups: [
      { id: "photochromic-women", title: "Female", gender: "women", feature: "photochromic" },
      { id: "photochromic-men", title: "Male", gender: "men", feature: "photochromic" },
      { id: "photochromic-unisex", title: "Unisex", gender: "unisex", feature: "photochromic" }
    ]
  },
  {
    title: "Anti-blue Glasses",
    sectionId: "anti-blue-section",
    groups: [
      { id: "antiblue-women", title: "Female", gender: "women", feature: "antiblue" },
      { id: "antiblue-men", title: "Male", gender: "men", feature: "antiblue" },
      { id: "antiblue-unisex", title: "Unisex", gender: "unisex", feature: "antiblue" }
    ]
  }
];

const COLLECTION_GROUPS = COLLECTION_SECTIONS.flatMap((section) => section.groups);
const FEATURE_AUDIENCES = new Set(["photochromic", "antiblue", "prescrip"]);

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

  if (compact.includes("fashion")) {
    return "fashion";
  }

  if (compact.includes("photochromic")) {
    return "photochromic";
  }

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
  if (/\bphotochromic\b/.test(value)) return "photochromic";
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

function productMatchesCollectionGroup(product, group) {
  const audiences = new Set(resolveAudiences(product));
  const hasFeatureAudience = [...audiences].some((audience) => FEATURE_AUDIENCES.has(audience));
  if (group.strictFashion && hasFeatureAudience) return false;
  if (group.feature && !audiences.has(group.feature)) return false;
  return audiences.has(group.gender);
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

function groupProductsByCollection(items) {
  const grouped = COLLECTION_GROUPS.reduce((acc, group) => {
    acc[group.id] = [];
    return acc;
  }, {});

  (items || []).forEach((product) => {
    COLLECTION_GROUPS.forEach((group) => {
      if (!productMatchesCollectionGroup(product, group)) return;
      if (!grouped[group.id].some((entry) => entry.id === product.id)) {
        grouped[group.id].push(product);
      }
    });
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
  const sectionRef = useRef(null);
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
    if (!openProductActionsId || typeof document === "undefined") return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const openMenu = sectionRef.current?.querySelector(".collection-action-menu.is-open");
      if (openMenu?.contains(target)) return;
      setOpenProductActionsId("");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openProductActionsId]);

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
    () => groupProductsByCollection((products || []).filter((product) => canDisplayOnStorefront(product))),
    [products]
  );
  const visibleProductsByAudience = useMemo(
    () => groupProductsByCollection(visibleProducts),
    [visibleProducts]
  );

  const visibleCollectionSections = useMemo(() => {
    const source = isSearching ? visibleProductsByAudience : allProductsByAudience;
    if (!isSearching) {
      return COLLECTION_SECTIONS.map((section) => ({
        ...section,
        groups: section.groups.filter((group) => (source[group.id] || []).length > 0)
      })).filter((section) => section.groups.length > 0);
    }
    return COLLECTION_SECTIONS.map((section) => ({
      ...section,
      groups: section.groups.filter((group) => (source[group.id] || []).length > 0)
    })).filter((section) => section.groups.length > 0);
  }, [allProductsByAudience, isSearching, visibleProductsByAudience]);

  const toggleSection = (audience) => {
    setExpandedSections((current) => ({ ...current, [audience]: !current[audience] }));
  };

  const toggleProductActions = (productId) => {
    setOpenProductActionsId((current) => (current === productId ? "" : productId));
  };

  return (
    <section ref={sectionRef} className={`shop-sections themed-product-section themed-product-${themeVariant}`} id="shop">
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

        {visibleCollectionSections.map((section) => {
          return (
            <section className="collection-block" id={section.sectionId} key={section.sectionId}>
              <div className="collection-header">
                <div className="lined-heading">
                  <span />
                  <h2>{section.title}</h2>
                  <span />
                </div>
              </div>

              {section.groups.map((group) => {
                const visibleItemsAll = visibleProductsByAudience[group.id] || [];
                const isExpanded = Boolean(expandedSections[group.id]);
                const visibleItems = isExpanded
                  ? visibleItemsAll
                  : visibleItemsAll.slice(0, collapsedItemCount);
                const canExpand = visibleItemsAll.length > collapsedItemCount;

                return (
                  <div className="collection-subgroup" key={group.id}>
                    <h3 className="collection-subheading">{group.title}</h3>
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

                    {canExpand ? (
                      <div className="collection-footer-toggle">
                        <button
                          type="button"
                          className="section-toggle-link"
                          onClick={() => toggleSection(group.id)}
                        >
                          {isExpanded ? "Show Less" : "View Full Products"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          );
        })}
        {isSearching && visibleCollectionSections.length === 0 ? (
          <p className="collection-empty">No glasses matched your search.</p>
        ) : null}
      </div>
    </section>
  );
}

export default ArrivalsSection;
