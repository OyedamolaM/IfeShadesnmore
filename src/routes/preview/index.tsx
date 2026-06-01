import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/preview/")({
  beforeLoad: () => {
    throw redirect({ to: "/preview/v1" });
  }
});
