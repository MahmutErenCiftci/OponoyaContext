export const dynamic = "force-dynamic";

/** Container liveness for the web process; the API's own health is reported by the API. */
export function GET() {
  return Response.json({ ok: true, service: "devcontext-web" }, { headers: { "cache-control": "no-store" } });
}
