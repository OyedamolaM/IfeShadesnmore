import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";

export const Route = createFileRoute("/account/login")({
  head: () => noindexHead("Customer Login | IfeShades & More"),
  component: () => <App screen="account-login" />
});

function noindexHead(title: string) {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex,nofollow" }
    ]
  };
}
