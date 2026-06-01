import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getInitialAppData } from "../../serverFns";

export const Route = createFileRoute("/account/verify-email")({
  loader: () => getInitialAppData(),
  head: () => ({
    meta: [
      { title: "Verify Email | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="verify-email" initialStorefront={data.storefront} initialUser={data.user} />;
  }
});
