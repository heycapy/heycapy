import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", ".next", "src/**/*.test.{ts,tsx}"],
    },
  },
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
});
