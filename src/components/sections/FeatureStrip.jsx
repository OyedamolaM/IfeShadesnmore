import FeatureIcon from "../icons/FeatureIcon";
import { FEATURE_ITEMS } from "../../constants/storefront";

function FeatureStrip() {
  return (
    <section className="why-choose-section" id="about">
      <div className="container">
        <div className="lined-heading">
          <span />
          <h2>Why Choose Us</h2>
          <span />
        </div>

        <div className="why-grid">
          {FEATURE_ITEMS.map((item) => (
            <article key={item.type}>
              <FeatureIcon type={item.type} />
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
