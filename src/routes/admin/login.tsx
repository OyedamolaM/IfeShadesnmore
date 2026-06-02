import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getAuthOnlyData } from "../../serverFns";

export const Route = createFileRoute("/admin/login")({
  loader: () => getAuthOnlyData(),
  head: () => ({
    meta: [
      { title: "Admin Login | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="admin-login" initialUser={data.user} />;
  }
});
