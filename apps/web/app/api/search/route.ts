import type { NextRequest } from "next/server";
import { proxyToApi } from "../../../lib/proxy";

export function GET(request: NextRequest) {
  return proxyToApi(request, [], { prefix: "/v1/search", unavailableMessage: "Arama şu an kullanılamıyor." });
}
