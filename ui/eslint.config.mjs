import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Keep the UI/math-engine boundary at the engine's public API. The engine
  // runs in-process client-side (#136), so nothing mechanically stops a deep
  // import into its internals the way the old HTTP boundary did — this rule
  // does. Import from the 'math-engine' package entry (or the lightweight
  // 'math-engine-client' shim), never 'math-engine/src/*' or '/dist/*'.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["math-engine/*"],
              message:
                "Import from the 'math-engine' package entry (or the 'math-engine-client' shim), not deep engine internals — keep the UI/engine boundary at the public API.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
