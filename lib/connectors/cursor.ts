import { createHmac, timingSafeEqual } from "node:crypto";

const CURSOR_TTL_MS = 60_000;

interface CursorPayload {
  v: 1;
  kind: "vendors" | "recon";
  query: string;
  snapshot: string;
  offset: number;
  expiresAt: number;
}

function secret(): string | null {
  return process.env.CONNECTOR_CURSOR_SECRET?.trim() || null;
}

function sign(encoded: string, key: string): string {
  return createHmac("sha256", key).update(encoded).digest("base64url");
}

export function createConnectorCursor(
  payload: Omit<CursorPayload, "v" | "expiresAt">,
  now = Date.now(),
): string | null {
  const key = secret();
  if (!key) return null;
  const encoded = Buffer.from(
    JSON.stringify({ ...payload, v: 1, expiresAt: now + CURSOR_TTL_MS }),
  ).toString("base64url");
  return `${encoded}.${sign(encoded, key)}`;
}

export function parseConnectorCursor(
  raw: string,
  expected: Pick<CursorPayload, "kind" | "query">,
  now = Date.now(),
): CursorPayload | null {
  const key = secret();
  const [encoded, suppliedSignature, extra] = raw.split(".");
  if (!key || !encoded || !suppliedSignature || extra) return null;
  const wanted = Buffer.from(sign(encoded, key));
  const supplied = Buffer.from(suppliedSignature);
  if (wanted.length !== supplied.length || !timingSafeEqual(wanted, supplied)) return null;

  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CursorPayload;
    if (
      value.v !== 1 ||
      value.kind !== expected.kind ||
      value.query !== expected.query ||
      !Number.isInteger(value.offset) ||
      value.offset < 0 ||
      typeof value.snapshot !== "string" ||
      !value.snapshot ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export const CONNECTOR_CURSOR_TTL_SECONDS = CURSOR_TTL_MS / 1000;
