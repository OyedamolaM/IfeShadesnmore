import { createFileRoute } from "@tanstack/react-router";
import App from "../../App.jsx";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login | IfeShades & More" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  }),
  component: () => <App screen="admin-login" />
});
