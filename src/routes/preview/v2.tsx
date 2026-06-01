import { createFileRoute, useNavigate } from "@tanstack/react-router";
import PreviewStorefront from "../../pages/PreviewStorefront";
import { getInitialAppData } from "../../serverFns";

export const Route = createFileRoute("/preview/v2")({
  loader: () => getInitialAppData(),
  head: () => ({
    meta: [
      { title: "Preview 02 - Warm Earth | IfeShadesnMore" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: PreviewRoute
});

function PreviewRoute() {
  const navigate = useNavigate();
  const { storefront, user } = Route.useLoaderData();
  return (
    <PreviewStorefront
      products={storefront.products}
      settings={storefront.settings}
      currentUser={user}
      styleVariant="v2"
      onStyleVariantChange={(id) => navigate({ to: `/preview/${id}` })}
      onOpenAdmin={() => navigate({ to: user?.role === "admin" ? "/admin" : "/admin/login" })}
      onOpenCart={() => {}}
      onOpenProfile={() => navigate({ to: user ? (user.role === "admin" ? "/admin" : "/account") : "/account/login" })}
      onOpenAbout={() => navigate({ to: "/" })}
      onViewProduct={() => {}}
      onAddToCart={() => {}}
      cartCount={0}
      allowOrdering={false}
      rotateHeroImages={false}
    />
  );
}
