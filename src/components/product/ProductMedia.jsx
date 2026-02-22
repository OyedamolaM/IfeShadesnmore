import { useEffect, useState } from "react";

const FALLBACK_GLASSES_IMAGE = "/hero/UnisexGlasses.jpg";

function normalizeHeroPath(value) {
  const src = String(value || "").trim();
  if (!src) return "";
  if (src === "/hero/female-glasses.jpg") return "/hero/Female-glasses.jpg";
  return src;
}

function ProductMedia({ product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedImage = normalizeHeroPath(product.image);

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedImage]);

  const src = !imageFailed && normalizedImage ? normalizedImage : FALLBACK_GLASSES_IMAGE;
  const alt = product.name || "Eyeglasses";

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (src !== FALLBACK_GLASSES_IMAGE) {
          setImageFailed(true);
        }
      }}
    />
  );
}

export default ProductMedia;
