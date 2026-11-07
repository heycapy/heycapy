import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      "no-console": "error",
      "no-debugger": "error",
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["pixelarticons", "pixelarticons/*", "lucide-react", "lucide-react/*"],
              message: "Use <Icon name> from @/components/ui/Icon; icon sets live in ui/icons.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/ui/icons.ts"],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
