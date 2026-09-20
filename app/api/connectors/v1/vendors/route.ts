import type { NextRequest } from "next/server";
import { scheduleConnectorTelemetry } from "@/lib/analytics/posthog-server";
import { createConnectorCursor, parseConnectorCursor } from "@/lib/connectors/cursor";
import { authorizeConnectorRequest, connectorError, connectorJson } from "@/lib/connectors/http";
import { ConnectorQueryError, CONNECTOR_RANKING_VERSION, searchConnectorVendors } from "@/lib/connectors/query";
import { createConnectorSupabaseClient } from "@/lib/connectors/supabase";
import {
  ConnectorValidationError,
  normalizedSearchHash,
  parseConnectorSearch,
} from "@/lib/connectors/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const started = Date.now();
  const auth = await authorizeConnectorRequest(request, "search_vendors");
  if (auth.response) return auth.response;
  const { requestId } = auth.context!;
  const trackFailure = (status: number) => scheduleConnectorTelemetry({
    operation: "search_vendors",
    partner: "muse",
    status,
    duration_ms: Date.now() - started,
    request_id: requestId,
  });

  try {
    const input = parseConnectorSearch(request.nextUrl.searchParams);
    const queryHash = normalizedSearchHash(input);
    let offset = 0;
    let cursorSnapshot: string | null = null;
    if (input.cursor) {
      const cursor = parseConnectorCursor(input.cursor, { kind: "vendors", query: queryHash });
      if (!cursor) {
        trackFailure(400);
        return connectorError(requestId, 400, "invalid_cursor", "Cursor is invalid or expired; repeat the search without a cursor", { retryable: true });
      }
      offset = cursor.offset;
      cursorSnapshot = cursor.snapshot;
    }

    const supabase = createConnectorSupabaseClient();
    const search = await searchConnectorVendors(supabase, input);
    if (cursorSnapshot && cursorSnapshot !== search.snapshot) {
      trackFailure(400);
      return connectorError(requestId, 400, "cursor_expired", "Search data changed; repeat the search without a cursor", { retryable: true });
    }

    const results = search.allResults.slice(offset, offset + input.limit);
    const nextOffset = offset + results.length;
    const nextCursor = nextOffset < search.allResults.length
      ? createConnectorCursor({ kind: "vendors", query: queryHash, snapshot: search.snapshot, offset: nextOffset })
      : null;
    if (nextOffset < search.allResults.length && !nextCursor) {
      trackFailure(503);
      return connectorError(requestId, 503, "connector_unavailable", "Pagination is temporarily unavailable");
    }

    const response = connectorJson({
      query_interpretation: search.queryInterpretation,
      results,
      next_cursor: nextCursor,
      as_of: new Date().toISOString(),
      warnings: search.warnings,
      ranking_version: CONNECTOR_RANKING_VERSION,
      request_id: requestId,
    }, requestId);
    scheduleConnectorTelemetry({
      operation: "search_vendors",
      partner: "muse",
      status: 200,
      duration_ms: Date.now() - started,
      request_id: requestId,
      ...(input.category && { category: input.category }),
      ...(input.locationId && { location_id: input.locationId }),
      result_count: results.length,
      partial_result_count: results.filter((result) => result.match_status === "partial").length,
    });
    return response;
  } catch (error) {
    if (error instanceof ConnectorValidationError) {
      trackFailure(400);
      return connectorError(requestId, 400, "invalid_request", error.message, error.details);
    }
    if (error instanceof ConnectorQueryError) {
      const status = error.code === "scope_too_broad" ? 400 : 503;
      trackFailure(status);
      return connectorError(requestId, status, error.code, error.message, status === 503 ? { retryable: true } : undefined);
    }
    console.error(`[connector:${requestId}] vendor search failed`, error instanceof Error ? error.message : "unknown error");
    trackFailure(503);
    return connectorError(requestId, 503, "upstream_unavailable", "Vendor search is temporarily unavailable", { retryable: true });
  }
}
