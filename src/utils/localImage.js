const MAX_STORED_IMAGE_BYTES = 3.5 * 1024 * 1024;

export function readImageAsDataUrl(file) {
  if (!file) return Promise.resolve("");
  if (!String(file.type || "").startsWith("image/")) {
    return Promise.reject(new Error("Choose an image file."));
  }
  if (file.size > MAX_STORED_IMAGE_BYTES) {
    return Promise.reject(new Error("Image must be 3.5MB or smaller until Cloudinary is configured."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}
