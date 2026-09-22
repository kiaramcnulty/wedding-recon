import { connectorOpenApi } from "@/lib/connectors/openapi";

export const dynamic = "force-static";

export function GET() {
  return Response.json(connectorOpenApi(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
