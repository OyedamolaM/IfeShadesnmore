import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getInitialAppData } from "../../serverFns";

export const Route = createFileRoute("/payment/callback")({
  loader: () => getInitialAppData(),
  head: () => ({
    meta: [
      { title: "Payment Status | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="payment-callback" initialStorefront={data.storefront} initialUser={data.user} />;
  }
});
