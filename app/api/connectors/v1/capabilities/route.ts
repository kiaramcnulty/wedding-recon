import type { NextRequest } from "next/server";
import { connectorCapabilities } from "@/lib/connectors/capabilities";
import { authorizeConnectorRequest, connectorError, connectorJson } from "@/lib/connectors/http";
import { scheduleConnectorTelemetry } from "@/lib/analytics/posthog-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const started = Date.now();
  const auth = await authorizeConnectorRequest(request, "capabilities");
  if (auth.response) return auth.response;
  const { requestId } = auth.context!;
  if ([...request.nextUrl.searchParams.keys()].length > 0) {
    scheduleConnectorTelemetry({ operation: "capabilities", partner: "muse", status: 400, duration_ms: Date.now() - started, request_id: requestId });
    return connectorError(requestId, 400, "invalid_request", "Capabilities does not accept query parameters");
  }
  const response = connectorJson(
    { data: connectorCapabilities(), request_id: requestId, as_of: new Date().toISOString() },
    requestId,
  );
  scheduleConnectorTelemetry({
    operation: "capabilities",
    partner: "muse",
    status: 200,
    duration_ms: Date.now() - started,
    request_id: requestId,
  });
  return response;
}
