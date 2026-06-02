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

export const getProductPageData = createServerFn({ method: "GET" })
  .inputValidator((slugId: string) => slugId)
  .handler(async ({ data }) => {
    const { getProductBySlugId } = await import("../server/apiCore.js");
    return getProductBySlugId(data);
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
