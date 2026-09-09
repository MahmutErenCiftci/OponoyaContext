import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerHealthRoutes } from "../src/modules/health/routes.js";

describe("health", () => {
  it("returns healthy", async () => {
    const app = Fastify();
    await registerHealthRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "devcontext-api",
    });

    await app.close();
  });
});
