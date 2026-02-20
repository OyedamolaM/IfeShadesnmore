import { useEffect, useState } from "react";
import FrameArtwork from "../art/FrameArtwork";

function ProductMedia({ product }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [product.image]);

  if (product.image && !imageFailed) {
    return (
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <FrameArtwork variant={product.variant} />;
}

export default ProductMedia;
