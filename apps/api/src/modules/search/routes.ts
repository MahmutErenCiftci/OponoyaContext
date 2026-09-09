import type { FastifyInstance } from "fastify";
import { searchQuerySchema } from "@devcontext/contracts";
import type { SearchService } from "./service.js";

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

export async function registerSearchRoutes(app: FastifyInstance, search: SearchService) {
  app.get("/v1/search", { preHandler: app.authenticate }, async (request) => {
    const query = searchQuerySchema.parse(request.query);
    return search.search(ownerId(request), query.q, query.limit);
  });
}
