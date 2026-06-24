import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const getInitialAppData = createServerFn({ method: "GET" }).handler(async () => {
  const { getStorefrontPayload, getCurrentUserFromFetchRequest } = await import("../server/apiCore.js");
  const request = getRequest();
  const [storefront, user] = await Promise.all([
    getStorefrontPayload(),
    request ? getCurrentUserFromFetchRequest(request) : null
  ]);
  return { storefront, user };
});

export const getAuthOnlyData = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentUserFromFetchRequest } = await import("../server/apiCore.js");
  const request = getRequest();
  return { user: request ? await getCurrentUserFromFetchRequest(request) : null };
});

export const getProductPageData = createServerFn({ method: "GET" })
  .inputValidator((slugId: string) => slugId)
  .handler(async ({ data }) => {
    const { getProductBySlugId } = await import("../server/apiCore.js");
    const product = await getProductBySlugId(data);
    if (!product) return null;
    return {
      ...product,
      seoSiteUrl: getRequestSiteUrl()
    };
  });

export const getBlogPageData = createServerFn({ method: "GET" })
  .inputValidator((slugId: string) => slugId)
  .handler(async ({ data }) => {
    const { getBlogBySlugId } = await import("../server/apiCore.js");
    return getBlogBySlugId(data);
  });

export const getSeoStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const { getStorefrontPayload } = await import("../server/apiCore.js");
  return getStorefrontPayload();
});

function getRequestSiteUrl() {
  const request = getRequest();
  const headers = request?.headers;
  const host = headers?.get("x-forwarded-host") || headers?.get("host") || "";
  if (host) {
    const protocol =
      headers?.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${protocol}://${host}`.replace(/\/+$/, "");
  }

  return String(
    process.env.SITE_URL ||
      process.env.FRONTEND_URL ||
      process.env.VITE_SITE_URL ||
      process.env.VITE_FRONTEND_URL ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");
}
