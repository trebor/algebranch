// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { FeedbackStore, StoredFeedbackEntry } from './feedbackStore';
import {
  type CloudflareKvConfig,
  cloudflareKvConfigFromEnv,
  kvValuesApi,
} from '@/server/share/cloudflareKvStore';

/**
 * Cloudflare KV adapter for the feedback store (#519) — the one concrete backend
 * behind {@link FeedbackStore} today. It reuses the share namespace, token, and
 * REST plumbing (`kvValuesApi`): feedback reports live under an `fb:` key prefix
 * alongside the short links, so there is no new vendor, namespace, or credential.
 * Like the share store, this module must only ever be imported by server code.
 *
 * `put` is a plain write (no store-if-absent): ids are zero-padded, time-ordered,
 * and suffixed with randomness, so they are unique by construction. `list` uses
 * KV's key-metadata endpoint — which returns names in ascending (thus chronological)
 * order — then takes the newest slice and fetches those values, which is why the
 * admin read is bounded by `limit` value reads, not the whole namespace.
 */

/** Key prefix for every stored report. Distinct from the 14-char base62 share ids
 *  and from the `budget:` / `feedback-budget:` counters that share the namespace. */
export const FEEDBACK_KEY_PREFIX = 'fb:';

/**
 * How many key names to pull from KV before slicing to the requested limit. KV
 * has no descending list, so to return the newest N we scan the prefix and keep
 * the tail; this bounds that scan. Comfortably above any admin-view page size,
 * and far below a volume the daily write budget would ever allow to accumulate
 * in a day.
 */
const LIST_SCAN_LIMIT = 1000;

interface KvKeyListResponse {
  result?: { name: string }[];
}

export class CloudflareKvFeedbackStore implements FeedbackStore {
  private readonly authHeader: string;
  private readonly valueUrl: (key: string) => string;
  private readonly keysUrl: (query?: string) => string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudflareKvConfig) {
    ({ authHeader: this.authHeader, valueUrl: this.valueUrl, keysUrl: this.keysUrl } = kvValuesApi(config));
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async put(id: string, json: string): Promise<void> {
    const res = await this.fetchImpl(this.valueUrl(id), {
      method: 'PUT',
      headers: { Authorization: this.authHeader, 'Content-Type': 'text/plain' },
      body: json,
    });
    if (!res.ok) {
      throw new Error(`Cloudflare KV feedback put failed: ${res.status}`);
    }
  }

  async list(limit: number): Promise<StoredFeedbackEntry[]> {
    const query = `prefix=${encodeURIComponent(FEEDBACK_KEY_PREFIX)}&limit=${LIST_SCAN_LIMIT}`;
    const res = await this.fetchImpl(this.keysUrl(query), {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) {
      throw new Error(`Cloudflare KV feedback list failed: ${res.status}`);
    }
    const body = (await res.json()) as KvKeyListResponse;
    const names = (body.result ?? []).map((k) => k.name);
    // Ascending names are chronological (zero-padded ms); take the newest slice.
    const newest = names.slice(-limit).reverse();

    const entries = await Promise.all(
      newest.map(async (id) => {
        const json = await this.getValue(id);
        return json === null ? null : { id, json };
      }),
    );
    return entries.filter((e): e is StoredFeedbackEntry => e !== null);
  }

  /** Read one value; `null` on a 404 (key vanished between list and read). */
  private async getValue(id: string): Promise<string | null> {
    const res = await this.fetchImpl(this.valueUrl(id), {
      headers: { Authorization: this.authHeader },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Cloudflare KV feedback read failed: ${res.status}`);
    }
    return res.text();
  }
}

/** Build a {@link CloudflareKvFeedbackStore} from environment variables. */
export function cloudflareKvFeedbackStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): CloudflareKvFeedbackStore {
  return new CloudflareKvFeedbackStore(cloudflareKvConfigFromEnv(env));
}
