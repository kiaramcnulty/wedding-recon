import type { NextRequest } from "next/server";
import { scheduleConnectorTelemetry } from "@/lib/analytics/posthog-server";
import { createConnectorCursor, parseConnectorCursor } from "@/lib/connectors/cursor";
import { getConnectorVendor } from "@/lib/connectors/detail";
import { authorizeConnectorRequest, connectorError, connectorJson } from "@/lib/connectors/http";
import { ConnectorQueryError } from "@/lib/connectors/query";
import { createConnectorSupabaseClient } from "@/lib/connectors/supabase";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string }> },
) {
  const started = Date.now();
  const auth = await authorizeConnectorRequest(request, "get_vendor");
  if (auth.response) return auth.response;
  const { requestId } = auth.context!;
  const trackFailure = (status: number) => scheduleConnectorTelemetry({
    operation: "get_vendor",
    partner: "muse",
    status,
    duration_ms: Date.now() - started,
    request_id: requestId,
  });
  const { vendorId } = await context.params;
  const allowedParams = new Set(["recon_limit", "recon_cursor"]);
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    if (!allowedParams.has(key) || request.nextUrl.searchParams.getAll(key).length > 1) {
      trackFailure(400);
      return connectorError(requestId, 400, "invalid_request", `Unsupported or repeated query parameter '${key}'`);
    }
  }
  if (!UUID_RE.test(vendorId)) {
    trackFailure(400);
    return connectorError(requestId, 400, "invalid_request", "vendor_id must be a UUID");
  }

  const rawLimit = request.nextUrl.searchParams.get("recon_limit");
  const reconLimit = rawLimit == null ? 5 : Number(rawLimit);
  if (!Number.isInteger(reconLimit) || reconLimit < 1 || reconLimit > 10) {
    trackFailure(400);
    return connectorError(requestId, 400, "invalid_request", "recon_limit must be an integer from 1 to 10");
  }

  let reconOffset = 0;
  const rawCursor = request.nextUrl.searchParams.get("recon_cursor");
  if (rawCursor && rawCursor.length > 4_096) {
    trackFailure(400);
    return connectorError(requestId, 400, "invalid_request", "recon_cursor is too large");
  }
  if (rawCursor) {
    const cursor = parseConnectorCursor(rawCursor, { kind: "recon", query: vendorId });
    if (!cursor) {
      trackFailure(400);
      return connectorError(requestId, 400, "invalid_cursor", "Recon cursor is invalid or expired; repeat without a cursor", { retryable: true });
    }
    reconOffset = cursor.offset;
  }

  try {
    const result = await getConnectorVendor(createConnectorSupabaseClient(), vendorId, reconLimit, reconOffset);
    if (!result) {
      trackFailure(404);
      return connectorError(requestId, 404, "vendor_not_found", "Vendor was not found");
    }
    const nextCursor = result.hasMore
      ? createConnectorCursor({ kind: "recon", query: vendorId, snapshot: "active-recon", offset: reconOffset + reconLimit })
      : null;
    if (result.hasMore && !nextCursor) {
      trackFailure(503);
      return connectorError(requestId, 503, "connector_unavailable", "Recon pagination is temporarily unavailable");
    }
    const response = connectorJson({
      vendor: result.vendor,
      recon: result.recon,
      next_recon_cursor: nextCursor,
      as_of: new Date().toISOString(),
      warnings: result.warnings,
      request_id: requestId,
    }, requestId);
    scheduleConnectorTelemetry({
      operation: "get_vendor",
      partner: "muse",
      status: 200,
      duration_ms: Date.now() - started,
      request_id: requestId,
      category: result.vendor.category.id,
      result_count: result.recon.length,
    });
    return response;
  } catch (error) {
    if (error instanceof ConnectorQueryError) {
      trackFailure(503);
      return connectorError(requestId, 503, error.code, error.message, { retryable: true });
    }
    console.error(`[connector:${requestId}] vendor detail failed`, error instanceof Error ? error.message : "unknown error");
    trackFailure(503);
    return connectorError(requestId, 503, "upstream_unavailable", "Vendor details are temporarily unavailable", { retryable: true });
  }
}
