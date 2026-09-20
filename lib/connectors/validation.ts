import { createHash } from "node:crypto";
import { z } from "zod";
import {
  DAY_TYPES,
  SEASONS,
  VENDOR_FILTERS,
  type FilterDef,
} from "@/lib/constants/vendor-filters";
import { VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";
import { CONNECTOR_LOCATIONS, connectorLocation } from "./locations";

const MAX_FILTER_JSON_LENGTH = 4_000;
const MAX_FILTERS = 20;
const MONEY_MAX = 1_000_000_000;
const SEARCH_PARAMS = new Set([
  "q",
  "category",
  "location_id",
  "radius_miles",
  "budget_max",
  "budget_basis",
  "guest_count",
  "duration_hours",
  "filters",
  "limit",
  "cursor",
]);

export class ConnectorValidationError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}

export interface ParsedConnectorSearch {
  q?: string;
  category?: VendorType;
  locationId?: string;
  radiusMiles?: number;
  budgetMax?: number;
  budgetBasis?: string;
  guestCount?: number;
  durationHours?: number;
  filters: Record<string, unknown>;
  limit: number;
  cursor?: string;
}

const finitePositive = (label: string, max: number) =>
  z.coerce
    .number()
    .finite(`${label} must be finite`)
    .positive(`${label} must be positive`)
    .max(max, `${label} is too large`);

function parseOptionalNumber(
  value: string | null,
  schema: z.ZodType<number>,
  label: string,
): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ConnectorValidationError(parsed.error.issues[0]?.message ?? `Invalid ${label}`);
  return parsed.data;
}

function priceDef(category: VendorType): FilterDef | undefined {
  return VENDOR_FILTERS[category]?.find((definition) => definition.key === "price");
}

function validateRange(raw: unknown, definition: FilterDef): Record<string, unknown> {
  const maximum = definition.unit === "guests" ? 5_000 : definition.unit === "weeks" ? 520 : MONEY_MAX;
  const result = z
    .object({
      min: z.number().finite().min(0).max(maximum).optional(),
      max: z.number().finite().min(0).max(maximum).optional(),
      season: z.enum(SEASONS.map((item) => item.value) as [string, ...string[]]).optional(),
      day: z.enum(DAY_TYPES.map((item) => item.value) as [string, ...string[]]).optional(),
    })
    .strict()
    .safeParse(raw);
  if (!result.success) {
    throw new ConnectorValidationError(`Invalid range for filter '${definition.key}'`, {
      issues: result.error.issues.map((issue) => issue.message),
    });
  }
  if (result.data.min == null && result.data.max == null) {
    throw new ConnectorValidationError(`Filter '${definition.key}' requires min or max`);
  }
  if (result.data.min != null && result.data.max != null && result.data.min > result.data.max) {
    throw new ConnectorValidationError(`Filter '${definition.key}' has min greater than max`);
  }
  if ((result.data.season || result.data.day) && definition.rescaledBy !== "date_context") {
    throw new ConnectorValidationError(`Filter '${definition.key}' does not support season or day context`);
  }
  return result.data;
}

function validateFilters(raw: string | null, category: VendorType | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (!category) throw new ConnectorValidationError("filters requires category");
  if (raw.length > MAX_FILTER_JSON_LENGTH) throw new ConnectorValidationError("filters is too large");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConnectorValidationError("filters must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConnectorValidationError("filters must be a JSON object");
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > MAX_FILTERS) throw new ConnectorValidationError(`filters supports at most ${MAX_FILTERS} keys`);

  const definitions = new Map((VENDOR_FILTERS[category] ?? []).map((definition) => [definition.key, definition]));
  const clean: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const definition = definitions.get(key);
    if (!definition) throw new ConnectorValidationError(`Unknown filter '${key}' for category '${category}'`);

    if (definition.kind === "bool") {
      if (typeof value !== "boolean") throw new ConnectorValidationError(`Filter '${key}' must be boolean`);
      clean[key] = value;
    } else if (definition.kind === "multi") {
      if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
        throw new ConnectorValidationError(`Filter '${key}' must be a non-empty array`);
      }
      const allowed = new Set(definition.options?.map((option) => option.value) ?? []);
      const values = [...new Set(value.map(String))];
      if (values.some((item) => !allowed.has(item))) {
        throw new ConnectorValidationError(`Filter '${key}' contains an unsupported value`, {
          supported: [...allowed],
        });
      }
      clean[key] = values;
    } else {
      clean[key] = validateRange(value, definition);
    }
  }
  return clean;
}

export function parseConnectorSearch(params: URLSearchParams): ParsedConnectorSearch {
  for (const key of new Set(params.keys())) {
    if (!SEARCH_PARAMS.has(key)) throw new ConnectorValidationError(`Unknown query parameter '${key}'`);
    if (params.getAll(key).length > 1) throw new ConnectorValidationError(`Query parameter '${key}' may be supplied only once`);
  }
  const rawCategory = params.get("category")?.trim();
  const category = rawCategory && (VENDOR_TYPES as readonly string[]).includes(rawCategory)
    ? (rawCategory as VendorType)
    : undefined;
  if (rawCategory && !category) {
    throw new ConnectorValidationError(`Unsupported category '${rawCategory}'`, { supported: VENDOR_TYPES });
  }

  const rawQ = params.get("q")?.trim() || undefined;
  if (rawQ && rawQ.length > 200) throw new ConnectorValidationError("q must contain at most 200 characters");
  const q = rawQ;
  if (q && q.length < 2) throw new ConnectorValidationError("q must contain at least 2 characters");
  if (!q && !category) throw new ConnectorValidationError("category is required for discovery searches");

  const locationId = params.get("location_id")?.trim() || undefined;
  if (locationId && !connectorLocation(locationId)) {
    throw new ConnectorValidationError(`Unsupported location_id '${locationId}'`, {
      supported: CONNECTOR_LOCATIONS.map((location) => location.id),
    });
  }
  const radiusMiles = parseOptionalNumber(
    params.get("radius_miles"),
    finitePositive("radius_miles", 100),
    "radius_miles",
  );
  if (radiusMiles != null && !locationId) throw new ConnectorValidationError("radius_miles requires location_id");

  const budgetMax = parseOptionalNumber(params.get("budget_max"), finitePositive("budget_max", MONEY_MAX), "budget_max");
  const budgetBasis = params.get("budget_basis")?.trim() || undefined;
  if ((budgetMax == null) !== (budgetBasis == null)) {
    throw new ConnectorValidationError("budget_max and budget_basis must be supplied together");
  }
  if (budgetMax != null && !category) throw new ConnectorValidationError("budget requires category");
  if (budgetMax != null && category) {
    const definition = priceDef(category);
    if (!definition) throw new ConnectorValidationError(`Category '${category}' does not support budget search`);
    const supported = definition.basis ? [definition.basis] : ["reported"];
    if (!budgetBasis || !supported.includes(budgetBasis)) {
      throw new ConnectorValidationError(`Unsupported budget_basis '${budgetBasis}' for category '${category}'`, { supported });
    }
  }

  const filters = validateFilters(params.get("filters"), category);

  const guestCount = parseOptionalNumber(params.get("guest_count"), finitePositive("guest_count", 5_000).int(), "guest_count");
  const durationHours = parseOptionalNumber(params.get("duration_hours"), finitePositive("duration_hours", 24), "duration_hours");
  if (guestCount != null && category !== "venue" && category !== "food") {
    throw new ConnectorValidationError("guest_count is supported only for venue and food searches");
  }
  if (durationHours != null && category !== "venue") {
    throw new ConnectorValidationError("duration_hours is supported only for venue searches");
  }
  if (category === "food" && guestCount != null && budgetMax == null && filters.price == null) {
    throw new ConnectorValidationError("guest_count for food requires a price or budget filter");
  }
  if (durationHours != null && budgetMax == null && filters.price == null) {
    throw new ConnectorValidationError("duration_hours requires a price or budget filter");
  }
  const limit = parseOptionalNumber(params.get("limit"), finitePositive("limit", 10).int(), "limit") ?? 5;

  const cursor = params.get("cursor")?.trim() || undefined;
  if (cursor && cursor.length > 4_096) throw new ConnectorValidationError("cursor is too large");

  return {
    q,
    category,
    locationId,
    radiusMiles: locationId ? radiusMiles ?? 25 : undefined,
    budgetMax,
    budgetBasis,
    guestCount,
    durationHours,
    filters,
    limit,
    cursor,
  };
}

export function normalizedSearchHash(input: ParsedConnectorSearch): string {
  const normalized = {
    q: input.q?.toLowerCase(),
    category: input.category,
    locationId: input.locationId,
    radiusMiles: input.radiusMiles,
    budgetMax: input.budgetMax,
    budgetBasis: input.budgetBasis,
    guestCount: input.guestCount,
    durationHours: input.durationHours,
    filters: Object.fromEntries(Object.entries(input.filters).sort(([a], [b]) => a.localeCompare(b))),
    limit: input.limit,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
