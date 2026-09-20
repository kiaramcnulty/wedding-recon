import type { NextRequest } from "next/server";
import { authorizeConnectorRequest, connectorError, connectorJson } from "@/lib/connectors/http";
import { SITE_URL } from "@/lib/site";
import { scheduleConnectorTelemetry } from "@/lib/analytics/posthog-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const started = Date.now();
  const auth = await authorizeConnectorRequest(request, "root");
  if (auth.response) return auth.response;
  const { requestId } = auth.context!;
  if ([...request.nextUrl.searchParams.keys()].length > 0) {
    scheduleConnectorTelemetry({ operation: "root", partner: "muse", status: 400, duration_ms: Date.now() - started, request_id: requestId });
    return connectorError(requestId, 400, "invalid_request", "The connector root does not accept query parameters");
  }
  scheduleConnectorTelemetry({
    operation: "root",
    partner: "muse",
    status: 200,
    duration_ms: Date.now() - started,
    request_id: requestId,
  });
  return connectorJson({
    name: "Wedding Recon Muse connector",
    version: "v1",
    read_only: true,
    endpoints: {
      capabilities: `${SITE_URL}/api/connectors/v1/capabilities`,
      vendors: `${SITE_URL}/api/connectors/v1/vendors`,
      vendor: `${SITE_URL}/api/connectors/v1/vendors/{vendor_id}`,
    },
    documentation: `${SITE_URL}/developers/connectors`,
    openapi: `${SITE_URL}/openapi.json`,
    request_id: requestId,
  }, requestId);
}
