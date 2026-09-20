import { createHash, timingSafeEqual } from "node:crypto";

const HASH_RE = /^[a-f0-9]{64}$/i;

export type ConnectorAuthResult =
  | { ok: true; credentialId: string }
  | { ok: false; reason: "missing" | "invalid" | "misconfigured" };

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function configuredKeyHashes(raw = process.env.MUSE_CONNECTOR_API_KEY_HASHES): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, all) => HASH_RE.test(value) && all.indexOf(value) === index)
    .slice(0, 2);
}

/**
 * Compare every configured hash, even after a match, so rotation overlap does
 * not create an observable first-key/second-key timing difference.
 */
export function authenticateConnectorKey(
  provided: string | null,
  hashes = configuredKeyHashes(),
): ConnectorAuthResult {
  if (!provided) return { ok: false, reason: "missing" };
  if (hashes.length === 0) return { ok: false, reason: "misconfigured" };

  const candidate = Buffer.from(sha256Hex(provided), "hex");
  let matchedIndex = -1;
  hashes.forEach((hash, index) => {
    const expected = Buffer.from(hash, "hex");
    if (expected.length === candidate.length && timingSafeEqual(candidate, expected)) {
      matchedIndex = index;
    }
  });

  return matchedIndex >= 0
    ? { ok: true, credentialId: `muse-${matchedIndex + 1}-${hashes[matchedIndex].slice(0, 12)}` }
    : { ok: false, reason: "invalid" };
}
