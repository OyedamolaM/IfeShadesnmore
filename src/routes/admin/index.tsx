import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getInitialAppData } from "../../serverFns";

export const Route = createFileRoute("/admin/")({
  loader: () => getInitialAppData(),
  head: () => ({
    meta: [
      { title: "Admin | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="admin" initialStorefront={data.storefront} initialUser={data.user} />;
  }
});
