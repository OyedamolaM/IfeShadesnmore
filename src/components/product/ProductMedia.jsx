import { useEffect, useState } from "react";

const FALLBACK_GLASSES_IMAGE =
  "https://images.pexels.com/photos/46710/pexels-photo-46710.jpeg?cs=srgb&dl=pexels-pixabay-46710.jpg&fm=jpg";

function ProductMedia({ product }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [product.image]);

  const src = !imageFailed && product.image ? product.image : FALLBACK_GLASSES_IMAGE;
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
