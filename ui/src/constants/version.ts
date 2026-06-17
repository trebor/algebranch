/**
 * App version — single source of truth (issue #157).
 *
 * The value originates from the monorepo root `package.json` and is injected at
 * build time via `next.config.ts` (`env.NEXT_PUBLIC_APP_VERSION`). Import this
 * constant anywhere the app needs to display its version (e.g. the About dialog,
 * #140) rather than reading `process.env` directly.
 */
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
