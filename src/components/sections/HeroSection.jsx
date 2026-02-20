import { useEffect, useState } from "react";
import HeroArtwork from "../art/HeroArtwork";

function HeroSection({ settings }) {
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  useEffect(() => {
    setHeroImageFailed(false);
  }, [settings.heroImage]);

  return (
    <section className="hero-section" id="home">
      <div className="container hero-grid">
        <div className="hero-copy">
          <h1>{settings.heroTitle}</h1>
          <p>{settings.heroSubtitle}</p>
          <button type="button">{settings.heroButtonLabel}</button>
        </div>
        <div className="hero-image-wrap">
          {settings.heroImage && !heroImageFailed ? (
            <img
              src={settings.heroImage}
              alt="Model wearing Ife_ShadesnMore frames"
              onError={() => setHeroImageFailed(true)}
            />
          ) : (
            <HeroArtwork />
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
