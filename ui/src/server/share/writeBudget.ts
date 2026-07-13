// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Write-budget port for the share create endpoint (#505). The share store has no
 * TTL — links are forever (#480) — so the unauthenticated create route is a path
 * to unlimited *permanent* storage. This port lets the route core ask "may one
 * more write happen right now?" without knowing how the ledger is kept; the
 * concrete adapter (a TTL'd daily counter in the same Cloudflare KV namespace)
 * lives behind it, so the core stays unit-testable with a fake.
 *
 * The budget is a coarse, global bill-bound — not a precise gate and not
 * per-client fairness (that's the platform WAF rule's job). Adapters may be
 * eventually consistent; slightly overshooting the cap is acceptable.
 */
export interface WriteBudget {
  /**
   * The cap this budget enforces per UTC day. Surfaced in the 429 body as
   * `dailyLimit` so the client can tell users the real number instead of a
   * vague "busy" — the cap is a per-deploy dial, so the client must learn it
   * from the response, never hardcode it. The day rolls over at UTC midnight;
   * clients may compute "available again in …" from that.
   */
  readonly dailyCap: number;

  /**
   * Record one write attempt against the budget. Returns `true` when the write
   * may proceed, `false` when the budget is exhausted (the caller should answer
   * 429 and not touch the store).
   */
  consume(): Promise<boolean>;
}
