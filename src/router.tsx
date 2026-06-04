import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { NotFoundPage } from "./routes/__root";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultNotFoundComponent: NotFoundPage,
    scrollRestoration: true
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
