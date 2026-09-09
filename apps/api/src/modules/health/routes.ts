import type { FastifyInstance } from "fastify";

/** Liveness: the process answers. Dependencies are checked by `/ready`, never here. */
export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "devcontext-api",
    // Deployment identity for smoke checks and dashboards; absent when the route runs without the app configuration.
    ...(app.hasDecorator("config") ? { environment: app.config.APP_ENV, release: app.config.RELEASE } : {}),
  }));
}
