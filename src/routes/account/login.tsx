import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";
import { getInitialAppData } from "../../serverFns";

export const Route = createFileRoute("/account/login")({
  loader: () => getInitialAppData(),
  head: () => noindexHead("Customer Login | IfeShades & More"),
  component: () => {
    const data = Route.useLoaderData();
    return <App screen="account-login" initialStorefront={data.storefront} initialUser={data.user} />;
  }
});

function noindexHead(title: string) {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex,nofollow" }
    ]
  };
}
