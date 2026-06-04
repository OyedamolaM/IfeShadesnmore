import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getAuthOnlyData } from "../../serverFns";

export const Route = createFileRoute("/admin/storefront")({
  loader: () => getAuthOnlyData(),
  head: () => ({
    meta: [
      { title: "Admin Storefront Preview | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="admin-preview" initialUser={data.user} />;
  }
});
