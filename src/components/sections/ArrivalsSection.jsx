import ProductCard from "../product/ProductCard";

function ArrivalsSection({ arrivalProducts, featuredProducts }) {
  return (
    <section className="arrivals-section" id="shop">
      <div className="container">
        <h2>New Arrivals</h2>
        <div className="arrivals-grid">
          {arrivalProducts.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
        <div className="featured-grid">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ArrivalsSection;
