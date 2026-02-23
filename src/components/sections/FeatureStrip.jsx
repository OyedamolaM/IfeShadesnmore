import FeatureIcon from "../icons/FeatureIcon";
import { DEFAULT_FEATURE_ITEMS } from "../../constants/storefront";

function FeatureStrip({ items }) {
  const featureItems = Array.isArray(items) && items.length > 0 ? items : DEFAULT_FEATURE_ITEMS;
  return (
    <section className="why-choose-section" id="about">
      <div className="container">
        <div className="lined-heading">
          <span />
          <h2>Why Choose Us</h2>
          <span />
        </div>

        <div className="why-grid">
          {featureItems.map((item, index) => (
            <article key={`${item.type || "feature"}-${index}`}>
              <FeatureIcon type={item.type || DEFAULT_FEATURE_ITEMS[index % DEFAULT_FEATURE_ITEMS.length].type} />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeatureStrip;
