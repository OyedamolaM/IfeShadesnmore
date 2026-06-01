import { Link } from "@tanstack/react-router";
import ProductMedia from "./ProductMedia";
import { toPrice } from "../../utils/format";

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

function ProductCard({ product, compact = false }) {
  return (
    <article className={compact ? "product-card compact" : "product-card"}>
      <div className="product-media">
        <ProductMedia product={product} />
      </div>
      <div className="product-meta">
        <h3>{product.name}</h3>
        {compact ? <p>{toPrice(product.price)}</p> : null}
        <Link to="/products/$slugId" params={{ slugId: productSlugId(product) }}>
          Shop Now
        </Link>
      </div>
    </article>
  );
}

export default ProductCard;
