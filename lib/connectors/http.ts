import { NextResponse, type NextRequest } from "next/server";
import { authenticateConnectorKey } from "./auth";
import { checkRateLimitStrict } from "@/lib/rate-limit";
import {
  scheduleConnectorTelemetry,
  type ConnectorTelemetry,
} from "@/lib/analytics/posthog-server";

export interface ConnectorRequestContext {
  requestId: string;
  credentialId: string;
}

const commonHeaders = (requestId: string) => ({
  "Cache-Control": "private, no-store",
  "X-Request-ID": requestId,
  Vary: "X-API-Key",
});

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function connectorJson(
  body: unknown,
  requestId: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...commonHeaders(requestId), ...(init.headers ?? {}) },
  });
}

export function connectorError(
  requestId: string,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextResponse {
  return connectorJson(
    { error: { code, message, request_id: requestId, ...(details && { details }) } },
    requestId,
    { status, headers },
  );
}

export async function authorizeConnectorRequest(
  request: NextRequest,
  operation: ConnectorTelemetry["operation"],
): Promise<{ context?: ConnectorRequestContext; response?: NextResponse }> {
  const requestId = crypto.randomUUID();
  const trackFailure = (status: number) => scheduleConnectorTelemetry({
    operation,
    partner: "muse",
    status,
    duration_ms: 0,
    request_id: requestId,
  });
  const auth = authenticateConnectorKey(request.headers.get("x-api-key"));
  if (!auth.ok) {
    if (auth.reason === "misconfigured") {
      trackFailure(503);
      return {
        response: connectorError(requestId, 503, "connector_unavailable", "Connector authentication is temporarily unavailable"),
      };
    }
    trackFailure(401);
    return {
      response: connectorError(requestId, 401, "unauthorized", "A valid X-API-Key header is required"),
    };
  }

  const perMinute = positiveInteger(process.env.CONNECTOR_RATE_LIMIT_PER_MINUTE, 60);
  const perDay = positiveInteger(process.env.CONNECTOR_RATE_LIMIT_PER_DAY, 10_000);
  const minute = await checkRateLimitStrict(`connector:minute:${auth.credentialId}`, perMinute, 60);
  if (minute === "unavailable") {
    trackFailure(503);
    return { response: connectorError(requestId, 503, "quota_unavailable", "Request quota could not be enforced; retry shortly", undefined, { "Retry-After": "30" }) };
  }
  if (minute === "limited") {
    trackFailure(429);
    return { response: connectorError(requestId, 429, "rate_limited", "Minute request limit exceeded", undefined, { "Retry-After": "60" }) };
  }

  const daily = await checkRateLimitStrict(`connector:day:${auth.credentialId}`, perDay, 86_400);
  if (daily === "unavailable") {
    trackFailure(503);
    return { response: connectorError(requestId, 503, "quota_unavailable", "Request quota could not be enforced; retry shortly", undefined, { "Retry-After": "30" }) };
  }
  if (daily === "limited") {
    trackFailure(429);
    return { response: connectorError(requestId, 429, "rate_limited", "Daily request limit exceeded", undefined, { "Retry-After": "3600" }) };
  }

  return { context: { requestId, credentialId: auth.credentialId } };
}
