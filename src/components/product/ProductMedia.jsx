import { useEffect, useState } from "react";

function normalizeHeroPath(value) {
  const src = String(value || "").trim();
  if (!src) return "";
  if (src === "/hero/female-glasses.jpg") return "/hero/Female-glasses.jpg";
  return src;
}

function optimizeRemoteImageUrl(value) {
  const src = String(value || "").trim();
  if (!src || src.startsWith("/") || src.startsWith("data:")) return src;

  try {
    const url = new URL(src);
    const host = String(url.hostname || "").toLowerCase();

    if (host.includes("images.pexels.com")) {
      url.searchParams.set("auto", "compress");
      url.searchParams.set("cs", "tinysrgb");
      url.searchParams.set("w", "1000");
      url.searchParams.set("dpr", "1");
      return url.toString();
    }

    if (host.includes("images.unsplash.com")) {
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("w", "1000");
      url.searchParams.set("q", "72");
      return url.toString();
    }

    return src;
  } catch {
    return src;
  }
}

function ProductMedia({ product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const gallery = Array.isArray(product?.images) ? product.images : [];
  const mainImageIndex = Math.max(0, Math.min(Number(product?.mainImageIndex) || 0, gallery.length - 1));
  const primaryImage = gallery[mainImageIndex] || product?.image;
  const normalizedImage = optimizeRemoteImageUrl(normalizeHeroPath(primaryImage));

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedImage]);

  const alt = product.name || "Eyeglasses";

  if (!normalizedImage || imageFailed) {
    return (
      <span className="product-image-missing" role="img" aria-label={`${alt} image unavailable`}>
        Image unavailable
      </span>
    );
  }

  return (
    <img
      src={normalizedImage}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setImageFailed(true)}
    />
  );
}

export default ProductMedia;
