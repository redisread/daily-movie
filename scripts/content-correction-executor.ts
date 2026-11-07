import { MoviePatch, type Movie } from "../src/shared/model";
import {
  canonical,
  fingerprint,
  type ContentEntry,
} from "./content-corrections";
export type ContentPlan = { apiBase: string; entries: ContentEntry[] };
export type ContentReceipt = {
  id: string;
  status: string;
  beforeEtag: string;
  afterEtag?: string;
  rollback?: unknown;
  requestId?: string | null;
};
export async function executeContentPlan(
  plan: ContentPlan,
  options: {
    apiKey: string;
    fetcher?: typeof fetch;
    onReceipt?: (entry: ContentReceipt) => void;
  },
) {
  const url = new URL(plan.apiBase),
    base = url.origin;
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !["https://daily-movie.jiahongw.com"].includes(base)
  )
    throw Error("Refusing credentials to an unknown origin");
  const { apiKey } = options;
  if (!apiKey || /[\r\n]/.test(apiKey) || JSON.stringify(plan).includes(apiKey))
    throw Error(
      "Invalid credential placement; key must stay in the executor environment",
    );
  if (!Array.isArray(plan.entries) || plan.entries.length > 1000)
    throw Error("Invalid reviewed plan");
  const fetcher = options.fetcher ?? fetch,
    ledger: ContentReceipt[] = [];
  const receipt = (entry: ContentReceipt) => {
    ledger.push(entry);
    options.onReceipt?.(entry);
  };
  const matches = (movie: Movie, values: Record<string, unknown>) =>
    Object.entries(values).every(
      ([field, value]) =>
        canonical(movie[field as keyof Movie]) === canonical(value),
    );
  // Read/validate EVERY target before the first write, avoiding avoidable partial runs.
  for (const e of plan.entries) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id) ||
      typeof e.expectedEtag !== "string" ||
      typeof e.quotesHash !== "string" ||
      !/^[\x21-\x7e]{1,128}$/.test(e.idempotencyKey) ||
      Object.keys(e.patch).some(
        (k) => !["posters", "whyThisMovie", "synopsis"].includes(k),
      )
    )
      throw Error("Plan contains invalid/out-of-scope data");
    MoviePatch.parse(e.patch);
    const read = await fetcher(`${base}/api/v1/movies/${e.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!read.ok)
      throw Error(
        `${e.id}: preflight HTTP ${read.status}, stopped before new writes`,
      );
    const current = ((await read.json()) as { data: Movie }).data;
    if (current.id !== e.id || fingerprint(current.quotes) !== e.quotesHash)
      throw Error(
        `${e.id}: quotes/identity changed since plan; reread/review required`,
      );
    // Matching target after a prior ambiguous attempt permits only ORIGINAL-key replay;
    // the server, not the client, decides whether there is an existing receipt.
    if (
      !(
        read.headers.get("etag") === e.expectedEtag &&
        matches(current, e.before)
      ) &&
      !matches(current, e.patch)
    )
      throw Error(
        `${e.id}: content/version conflict; stopped before new writes`,
      );
  }
  for (const e of plan.entries) {
    let response: Response;
    try {
      response = await fetcher(`${base}/api/v1/movies/${e.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "If-Match": e.expectedEtag,
          "Idempotency-Key": e.idempotencyKey,
        },
        body: JSON.stringify(e.patch),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      receipt({
        id: e.id,
        status: "network_outcome_uncertain",
        beforeEtag: e.expectedEtag,
        rollback: e.rollback,
      });
      throw Error(
        `${e.id}: write outcome uncertain; retain ORIGINAL plan/key for replay, do not regenerate`,
      );
    }
    const record: ContentReceipt = {
      id: e.id,
      status: response.ok
        ? "accepted_pending_verification"
        : `HTTP ${response.status}`,
      beforeEtag: e.expectedEtag,
      afterEtag: response.headers.get("etag") ?? undefined,
      rollback: e.rollback,
      requestId: response.headers.get("x-request-id"),
    };
    if (!response.ok) {
      receipt(record);
      throw Error(
        `${e.id}: PATCH HTTP ${response.status}; Retry-After ${response.headers.get("retry-after") ?? "n/a"}; stopped, retain original keys`,
      );
    }
    let updated: Movie;
    try {
      updated = ((await response.json()) as { data: Movie }).data;
    } catch {
      receipt(record);
      throw Error(
        `${e.id}: accepted but response unverified; retain original plan/key`,
      );
    }
    if (
      updated.id !== e.id ||
      fingerprint(updated.quotes) !== e.quotesHash ||
      !matches(updated, e.patch)
    ) {
      receipt(record);
      throw Error(
        `${e.id}: accepted result mismatch; stop and inspect, do not force overwrite`,
      );
    }
    receipt({ ...record, status: "applied_or_idempotent_replay" });
  }
  return ledger;
}
