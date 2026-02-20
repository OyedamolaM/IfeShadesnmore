import FeatureIcon from "../icons/FeatureIcon";
import { FEATURE_ITEMS } from "../../constants/storefront";

function FeatureStrip() {
  return (
    <section className="feature-strip container" id="about">
      {FEATURE_ITEMS.map((item) => (
        <article key={item.type}>
          <FeatureIcon type={item.type} />
          <div>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default FeatureStrip;
