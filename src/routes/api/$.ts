import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle
    }
  }
});

async function handle({ request, params }: { request: Request; params: { _splat?: string } }) {
  const { handleApiRequest } = await import("../../../server/apiCore.js");
  return handleApiRequest(request, params._splat || "");
}
