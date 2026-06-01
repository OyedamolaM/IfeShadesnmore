import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getInitialAppData } from "../../serverFns";

export const Route = createFileRoute("/account/")({
  loader: () => getInitialAppData(),
  head: () => ({
    meta: [
      { title: "My Account | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="account" initialStorefront={data.storefront} initialUser={data.user} />;
  }
});
