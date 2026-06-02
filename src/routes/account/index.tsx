import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getAuthOnlyData } from "../../serverFns";

export const Route = createFileRoute("/account/")({
  loader: () => getAuthOnlyData(),
  head: () => ({
    meta: [
      { title: "My Account | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="account" initialUser={data.user} />;
  }
});
