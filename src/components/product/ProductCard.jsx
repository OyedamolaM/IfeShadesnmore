import ProductMedia from "./ProductMedia";
import { toPrice } from "../../utils/format";

function ProductCard({ product, compact = false }) {
  return (
    <article className={compact ? "product-card compact" : "product-card"}>
      <div className="product-media">
        <ProductMedia product={product} />
      </div>
      <div className="product-meta">
        <h3>{product.name}</h3>
        {compact ? <p>{toPrice(product.price)}</p> : null}
        <button type="button">Shop Now</button>
      </div>
    </article>
  );
}

export default ProductCard;
