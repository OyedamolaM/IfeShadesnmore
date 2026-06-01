import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getInitialAppData } from "../../serverFns";

export const Route = createFileRoute("/admin/login")({
  loader: () => getInitialAppData(),
  head: () => ({
    meta: [
      { title: "Admin Login | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="admin-login" initialStorefront={data.storefront} initialUser={data.user} />;
  }
});
