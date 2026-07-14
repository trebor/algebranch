// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Unreadable / future `?ws=` links (#451). An unrecognized replay version used to
// log a console.warn and open a blank app; a corrupt payload only logged an error.
// Both now surface a toast. Also pins the SUPPORTED_WS_REPLAY_VERSIONS membership
// check: a current v3 link still loads (no error toast), a v99 link is refused with
// a "needs a newer version" toast instead of being silently discarded.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { Blob as NodeBlob } from 'node:buffer';
import { CompressionStream, DecompressionStream } from 'node:stream/web';
import Home from '@/app/page';
import { toastAtom } from '@/store/equation';
import { compressString } from 'math-engine-client';

// The share-link codec relies on Blob.stream() + (De)CompressionStream, which
// jsdom's Blob lacks. Swap in Node's web-stream implementations so the `?ws=`
// decode path actually runs under the render.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Blob = NodeBlob;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CompressionStream = CompressionStream;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DecompressionStream = DecompressionStream;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

const renderWithWs = async (ws: string) => {
  window.history.replaceState(null, '', `/?ws=${ws}`);
  const store = createStore();
  render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return store;
};

describe('unreadable / future `?ws=` links (#451)', () => {
  it('shows a "needs a newer version" toast for an unsupported replay version', async () => {
    const ws = await compressString(JSON.stringify({ v: 99, r: [], n: 0, a: 'future' }));
    const store = await renderWithWs(ws);
    await waitFor(() => {
      expect(store.get(toastAtom)?.message).toBe('This link needs a newer version of Algebranch to open.');
    });
    expect(window.location.search).toBe('');
  });

  it('shows a "couldn\'t be opened" toast for a corrupt payload', async () => {
    const store = await renderWithWs('not-a-valid-base64url-payload!!!');
    await waitFor(() => {
      expect(store.get(toastAtom)?.message).toBe(
        "This shared link couldn't be opened — it may be incomplete or corrupted.",
      );
    });
    expect(window.location.search).toBe('');
  });

  it('loads a current (v3) replay link without any error toast', async () => {
    // A frozen v3 fixture (see shareLinkFixtures.test.ts) — membership accepts it.
    const ws = 'eJxFjksKwkAQRK_S1FJrMJ_dgOsg7hRUCFlMMOJAm4-KGMRzeQAvJq0Ll6-qeNQDN_icOMOXpUuJAUQmE7nLVHKZS5qAWLTxGoOiYpkQNQgHIgdRaFcHFScGy40tUrMReryACbGOp17jYTTvzvrsZ5hZ8De8X2K0HVBVRPs9FeBRdLpvWlk1vYYRzw-2yS0M';
    const store = await renderWithWs(ws);
    await waitFor(() => {
      const msg = store.get(toastAtom)?.message;
      expect(msg).not.toBe('This link needs a newer version of Algebranch to open.');
      expect(msg).not.toBe("This shared link couldn't be opened — it may be incomplete or corrupted.");
    });
  });
});
