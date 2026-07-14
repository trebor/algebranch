// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { ShareStore } from './shareStore';

/**
 * Cloudflare KV adapter for the share store (#480) — the one concrete backend
 * behind {@link ShareStore} today. Talks to Cloudflare's KV REST API purely
 * server-to-server from the Vercel route handler; the browser never touches
 * Cloudflare directly, so the API token stays server-side and there is no CORS
 * surface (see the #480 same-origin guardrail). This module must only ever be
 * imported by server code (route handlers), never by a client component.
 *
 * KV has no native store-if-absent (writes are last-write-wins), so `put` guards
 * with a read: it probes for the id and writes only when absent. Collisions are
 * astronomically rare — a truncated SHA-256 of a random 128-bit key — so the tiny
 * read-then-write race window is acceptable, and the guard exists chiefly to avoid
 * clobbering an existing live link on the one-in-astronomical chance it happens.
 */

const KV_API_ROOT = 'https://api.cloudflare.com/client/v4';

export interface CloudflareKvConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * The URL + auth plumbing every KV REST call needs, built once from a config.
 * Shared by the share store and the write-budget adapter (#505) so the API
 * root, namespace path shape, and header format live in exactly one place.
 */
export function kvValuesApi({ accountId, namespaceId, apiToken }: CloudflareKvConfig): {
  authHeader: string;
  valueUrl: (key: string) => string;
  keysUrl: (query?: string) => string;
} {
  const baseUrl = `${KV_API_ROOT}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
  return {
    authHeader: `Bearer ${apiToken}`,
    valueUrl: (key) => `${baseUrl}/values/${encodeURIComponent(key)}`,
    // The metadata endpoint that lists key *names* (not values) under a prefix —
    // used by the feedback admin read (#519); shares/budget never call it.
    keysUrl: (query = '') => `${baseUrl}/keys${query ? `?${query}` : ''}`,
  };
}

export class CloudflareKvStore implements ShareStore {
  private readonly authHeader: string;
  private readonly valueUrl: (key: string) => string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudflareKvConfig) {
    ({ authHeader: this.authHeader, valueUrl: this.valueUrl } = kvValuesApi(config));
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async get(id: string): Promise<string | null> {
    const res = await this.fetchImpl(this.valueUrl(id), {
      headers: { Authorization: this.authHeader },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Cloudflare KV get failed: ${res.status}`);
    }
    return res.text();
  }

  async put(id: string, ciphertext: string): Promise<boolean> {
    // Store-if-absent: never overwrite an existing id — that would break the
    // live link already pointing at it. Collision → caller regenerates the key.
    if ((await this.get(id)) !== null) return false;

    const res = await this.fetchImpl(this.valueUrl(id), {
      method: 'PUT',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'text/plain',
      },
      body: ciphertext,
    });
    if (!res.ok) {
      throw new Error(`Cloudflare KV put failed: ${res.status}`);
    }
    return true;
  }
}

/** Env var names carrying the Cloudflare KV credentials (server-side only). */
const REQUIRED_ENV = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_KV_NAMESPACE_ID',
  'CLOUDFLARE_KV_API_TOKEN',
] as const;

/**
 * Read the Cloudflare KV credentials out of `env`, throwing a precise error
 * naming any missing var so a misconfigured deploy fails loudly rather than
 * silently 500-ing every share. Shared by the store and the write-budget
 * adapter (#505), which live in the same namespace behind the same token.
 */
export function cloudflareKvConfigFromEnv(
  env: Record<string, string | undefined>,
): CloudflareKvConfig {
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Cloudflare KV not configured — missing env: ${missing.join(', ')}`,
    );
  }
  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID!,
    namespaceId: env.CLOUDFLARE_KV_NAMESPACE_ID!,
    apiToken: env.CLOUDFLARE_KV_API_TOKEN!,
  };
}

/** Build a {@link CloudflareKvStore} from environment variables (see above). */
export function cloudflareKvStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): CloudflareKvStore {
  return new CloudflareKvStore(cloudflareKvConfigFromEnv(env));
}
