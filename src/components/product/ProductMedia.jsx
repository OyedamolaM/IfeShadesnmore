import { useEffect, useState } from "react";

const FALLBACK_GLASSES_IMAGE = "/hero/UnisexGlasses.jpg";

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
  const normalizedImage = optimizeRemoteImageUrl(normalizeHeroPath(product.image));

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
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== FALLBACK_GLASSES_IMAGE) {
          setImageFailed(true);
        }
      }}
    />
  );
}

export default ProductMedia;
