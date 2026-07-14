// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';

/**
 * Shared roving-tabindex primitive for composite widgets (#257).
 *
 * A composite widget (the expression tree, the workspace tabs, the history
 * tree) is a *single* Tab stop: exactly one descendant carries `tabIndex={0}`
 * and the rest `-1`, and arrow keys move the active item within it. This is the
 * standard WAI-ARIA pattern — and crucially **not** a focus trap: Tab and
 * Shift+Tab are left untouched so focus exits the widget naturally (WCAG 2.1.2,
 * No Keyboard Trap).
 *
 * The controller tracks items by an opaque string `key` (the AST path for the
 * expression, the tab id, the step id) and computes ordering from the live DOM
 * via `compareDocumentPosition`, so "next/prev in document order" stays correct
 * as the candidate set changes asynchronously without the consumer maintaining a
 * parallel ordered list.
 *
 * Region-specific arrow semantics (e.g. the expression's Up/Down =
 * ancestor/descendant) are layered by the consumer on top of `moveFocus`,
 * `orderedKeys`, and `setActive`; the default item handler covers the common
 * Left/Right/Home/End case.
 */

export type RovingDirection = 'next' | 'prev' | 'first' | 'last';

/**
 * Path-prefix resolvers over a set of registered AST-path keys, shared by the
 * expression's Up/Down arrow handlers (ancestor/descendant navigation) and the
 * cross-mode cursor carry-over (#373). Keys are `/`-joined AST paths, so an
 * ancestor is a strict path prefix and a descendant a strict path extension.
 */

/** The closest registered *strict* ancestor of `path` (longest matching prefix), or null. */
export function nearestAncestorKey(keys: string[], path: string): string | null {
  return (
    keys
      .filter((k) => path.startsWith(k + '/'))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

/**
 * The shallowest registered *strict* descendant of `path` (fewest extra path
 * segments), ties broken by the input order (document order, as `orderedKeys`
 * supplies), or null.
 */
export function nearestDescendantKey(keys: string[], path: string): string | null {
  return (
    keys
      .filter((k) => k.startsWith(path + '/'))
      .map((k) => ({ k, depth: k.split('/').length }))
      .sort((a, b) => a.depth - b.depth)[0]?.k ?? null
  );
}

/**
 * Resolve `path` against a registered key set for the cross-mode carry-over
 * (#373): the exact path when it re-registered in the incoming mode, else the
 * *closest* registered ancestor or descendant by path distance (segment count),
 * else null (let the caller fall back to its own default). On a tie the
 * descendant wins — it is the same-or-inner content (e.g. the child of a
 * transparent parenthesis the target mode doesn't register as its own stop),
 * which is more faithful than jumping out to a broader enclosing side.
 */
export function nearestRegisteredKey(keys: string[], path: string): string | null {
  if (keys.includes(path)) return path;
  const ancestor = nearestAncestorKey(keys, path);
  const descendant = nearestDescendantKey(keys, path);
  if (ancestor && descendant) {
    const depth = path.split('/').length;
    const ancestorDist = depth - ancestor.split('/').length;
    const descendantDist = descendant.split('/').length - depth;
    return descendantDist <= ancestorDist ? descendant : ancestor;
  }
  return ancestor ?? descendant;
}

export interface RovingContextValue {
  activeKey: string | null;
  /**
   * Register a focusable item. `primary` (default true) marks a "real" stop that
   * may be the default Tab entry point; `primary: false` marks an adjunct (a
   * folded-in handle) that arrow keys still reach but that never becomes the
   * entry point, so Tab never lands on a handle ahead of its term (#257).
   */
  registerItem: (key: string, el: HTMLElement, opts?: { primary?: boolean }) => void;
  unregisterItem: (key: string) => void;
  /** Keys of all registered items, sorted in document (visual) order. */
  orderedKeys: () => string[];
  /** Make `key` the active (tabbable) item; optionally move DOM focus to it. */
  setActive: (key: string, opts?: { focus?: boolean }) => void;
  /** Move the active item relative to its current position, focusing the result. */
  moveFocus: (dir: RovingDirection) => void;
  /** Move focus to the region container (Escape "release" out of the items). */
  focusContainer: () => void;
}

const RovingContext = React.createContext<RovingContextValue | null>(null);

function useRovingContext(): RovingContextValue {
  const ctx = React.useContext(RovingContext);
  if (!ctx) {
    throw new Error('useRovingItem/useRovingTabindex must be used within a RovingTabindexProvider');
  }
  return ctx;
}

export const RovingTabindexProvider: React.FC<{
  children: React.ReactNode;
  /** The composite-widget container; Escape returns focus here. */
  containerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Cross-mode cursor carry-over (#373): a path to restore on first mount instead
   * of the plain first-item default. It is resolved against *this* provider's
   * registered keys via `nearestRegisteredKey` (exact → nearest ancestor →
   * nearest descendant), falling back to the first item when nothing is near.
   * Consulted once, on the first seed after mount, and never against a stop the
   * user has since moved to.
   */
  seedKey?: string | null;
  /**
   * Whether seeding from `seedKey` should also move DOM focus to the restored
   * node (so a screen reader announces it). Only true when the outgoing mode's
   * tree currently held focus — a keyboard/SR user mid-navigation — so a pointer
   * user toggling modes is never yanked into the tree.
   */
  seedFocus?: boolean;
  /** Fires whenever the active key changes, so a consumer can mirror it out (#373). */
  onActiveKeyChange?: (key: string | null) => void;
  /**
   * Prefer the most specific primary as the default entry stop — skip a primary
   * that strictly contains another (a whole-side/ancestor stop) so the cursor
   * lands on an actual term, not an entire equation side (#373). The Interaction
   * tree opts in; the reader keeps its whole-expression overview default (#270),
   * and flat-key consumers (tabs, history) are unaffected either way.
   */
  preferSpecificDefault?: boolean;
}> = ({ children, containerRef, seedKey, seedFocus, onActiveKeyChange, preferSpecificDefault }) => {
  const registry = React.useRef<Map<string, HTMLElement>>(new Map());
  // Keys eligible to be the default entry stop (terms, not folded-in handles).
  const primaryKeys = React.useRef<Set<string>>(new Set());
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  // Whether the carry-over (#373) has already *moved focus* this mount. Gates the
  // focus move only — never which key is active — so the resolution stays
  // idempotent under a double-invoked effect (React StrictMode / concurrent
  // replay) instead of flip-flopping a consumed-once flag.
  const seedFocusedRef = React.useRef(false);
  // Whether the active item was chosen by the user (arrow/Home/End) rather than
  // auto-selected as the default. A user choice is never overridden when the item
  // set later changes; an auto-default may still be upgraded (e.g. from a handle
  // to a real term once the async candidate scan lands).
  const pinnedRef = React.useRef(false);

  // Bumped whenever the item set changes, so the validation effect re-runs and
  // (re-)assigns a valid active item without the consumer doing bookkeeping.
  const [registryVersion, setRegistryVersion] = React.useState(0);
  const bump = React.useCallback(() => setRegistryVersion((v) => v + 1), []);

  const orderedKeys = React.useCallback((): string[] => {
    const entries = Array.from(registry.current.entries());
    entries.sort(([, a], [, b]) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    return entries.map(([key]) => key);
  }, []);

  const registerItem = React.useCallback(
    (key: string, el: HTMLElement, opts?: { primary?: boolean }) => {
      registry.current.set(key, el);
      if (opts?.primary === false) primaryKeys.current.delete(key);
      else primaryKeys.current.add(key);
      bump();
    },
    [bump],
  );

  const unregisterItem = React.useCallback(
    (key: string) => {
      registry.current.delete(key);
      primaryKeys.current.delete(key);
      bump();
    },
    [bump],
  );

  // The default/entry stop: the first PRIMARY item in document order (a term), so
  // a leading secondary item (a folded-in handle) never becomes the entry point.
  // When `preferSpecificDefault` is set (the Interaction tree), prefer the most
  // specific primary — skip one that strictly *contains* another primary (a
  // whole-side/ancestor stop like the entire `lhs`), so the cursor lands on an
  // actual term rather than boxing an entire equation side (#373); the reader
  // keeps its whole-expression overview default (#270). Falls back to the first
  // item overall when nothing is primary (a node that hosts only a handle).
  const firstDefaultKey = React.useCallback((): string | null => {
    const keys = orderedKeys();
    if (keys.length === 0) return null;
    const primaries = keys.filter((k) => primaryKeys.current.has(k));
    if (primaries.length === 0) return keys[0];
    if (preferSpecificDefault) {
      const specific = primaries.find(
        (k) => !primaries.some((other) => other !== k && other.startsWith(k + '/')),
      );
      if (specific) return specific;
    }
    return primaries[0];
  }, [orderedKeys, preferSpecificDefault]);

  const setActive = React.useCallback((key: string, opts?: { focus?: boolean }) => {
    setActiveKey(key);
    // A focus-moving setActive is a deliberate user navigation (arrow/Home/End);
    // pin it so a later item-set change can't reassign the default out from under
    // them.
    if (opts?.focus) {
      pinnedRef.current = true;
      registry.current.get(key)?.focus();
    }
  }, []);

  const moveFocus = React.useCallback(
    (dir: RovingDirection) => {
      const keys = orderedKeys();
      if (keys.length === 0) return;
      const idx = activeKey ? keys.indexOf(activeKey) : -1;
      let next: number;
      switch (dir) {
        case 'next':
          next = idx < 0 ? 0 : Math.min(idx + 1, keys.length - 1);
          break;
        case 'prev':
          next = idx <= 0 ? 0 : idx - 1;
          break;
        case 'first':
          next = 0;
          break;
        case 'last':
          next = keys.length - 1;
          break;
      }
      setActive(keys[next], { focus: true });
    },
    [orderedKeys, setActive, activeKey],
  );

  // Correct the active item once the DOM is committed: default to the first
  // primary item in document order, and recover when the active item unregisters
  // (the candidate set shrank during a transform). Document ordering needs the
  // live DOM, so this can't be derived during render — hence the guarded effect.
  React.useEffect(() => {
    const keys = orderedKeys();
    if (keys.length === 0) {
      pinnedRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (activeKey !== null) setActiveKey(null);
      return;
    }
    const activeMissing = activeKey === null || !registry.current.has(activeKey);
    if (activeMissing) {
      // The active item is gone (or none yet). Cross-mode cursor carry-over
      // (#373): restore the path the user was on — resolved to the nearest
      // registered stop here — before the plain first-item default. `seedKey`
      // mirrors the live cursor, so re-resolving toward it on every miss both
      // rides out an incoming tree whose stops register a tick after mount and
      // recovers to the user's last place when a candidate set shrinks. The
      // resolution is idempotent (no consumed-once flag), so a double-invoked
      // effect can't fall through to the default.
      const carried = seedKey ? nearestRegisteredKey(keys, seedKey) : null;
      pinnedRef.current = false;
      setActiveKey(carried ?? firstDefaultKey());
      // Move focus onto the carried stop once per mount (#373) — never on a plain
      // auto-default, and gated separately from the key so effect replay can't
      // double-focus or, worse, skip the restore.
      if (carried && seedFocus && !seedFocusedRef.current) {
        seedFocusedRef.current = true;
        registry.current.get(carried)?.focus();
      }
      return;
    }
    // Upgrade an *auto-selected* default from a secondary item (a folded-in handle
    // that registered before the async candidate scan landed) to the first primary
    // term once one exists — but never override a stop the user moved to (#257).
    const activeIsSecondary = !primaryKeys.current.has(activeKey);
    const hasPrimary = keys.some((k) => primaryKeys.current.has(k));
    if (!pinnedRef.current && activeIsSecondary && hasPrimary) {
      setActiveKey(firstDefaultKey());
    }
  }, [activeKey, orderedKeys, firstDefaultKey, registryVersion, seedKey, seedFocus]);

  // Publish the live cursor so a consumer can mirror it across a mode switch
  // (#373). The outgoing provider unmounts on toggle, so the last value it
  // reports is what the incoming provider restores from via `seedKey`.
  const onActiveKeyChangeRef = React.useRef(onActiveKeyChange);
  React.useEffect(() => {
    onActiveKeyChangeRef.current = onActiveKeyChange;
  });
  React.useEffect(() => {
    onActiveKeyChangeRef.current?.(activeKey);
  }, [activeKey]);

  const focusContainer = React.useCallback(() => {
    containerRef?.current?.focus();
  }, [containerRef]);

  const value = React.useMemo<RovingContextValue>(
    () => ({ activeKey, registerItem, unregisterItem, orderedKeys, setActive, moveFocus, focusContainer }),
    [activeKey, registerItem, unregisterItem, orderedKeys, setActive, moveFocus, focusContainer],
  );

  return <RovingContext.Provider value={value}>{children}</RovingContext.Provider>;
};

/** Access the controller directly (container/consumer custom arrow logic). */
export function useRovingTabindex(): RovingContextValue {
  return useRovingContext();
}

/**
 * Non-throwing variant for consumers that may render outside a provider (e.g.
 * `EquationNode`, which falls back to legacy single-Tab-stop behavior when no
 * roving controller is present). Returns null when there is no provider.
 */
export function useOptionalRovingTabindex(): RovingContextValue | null {
  return React.useContext(RovingContext);
}

interface RovingItem {
  /** Callback ref — attach to the focusable element. */
  ref: (el: HTMLElement | null) => void;
  /** 0 for the single active item, -1 otherwise. */
  tabIndex: number;
  /** Whether this item is the active (tabbable) one. */
  isActive: boolean;
  /** Default handler: Left/Right move siblings, Home/End jump to ends. */
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function useRovingItem(key: string, opts?: { primary?: boolean }): RovingItem {
  const ctx = React.useContext(RovingContext);
  const primary = opts?.primary;

  const ref = React.useCallback(
    (el: HTMLElement | null) => {
      if (!ctx) return;
      if (el) ctx.registerItem(key, el, { primary });
      else ctx.unregisterItem(key);
    },
    [ctx, key, primary],
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!ctx) return;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          ctx.moveFocus('next');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          ctx.moveFocus('prev');
          break;
        case 'Home':
          e.preventDefault();
          ctx.moveFocus('first');
          break;
        case 'End':
          e.preventDefault();
          ctx.moveFocus('last');
          break;
      }
    },
    [ctx],
  );

  if (!ctx) {
    return {
      ref: () => {},
      tabIndex: 0,
      isActive: false,
      onKeyDown: () => {},
    };
  }

  return {
    ref,
    tabIndex: ctx.activeKey === key ? 0 : -1,
    isActive: ctx.activeKey === key,
    onKeyDown,
  };
}
