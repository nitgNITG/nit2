import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Level-4 agent evals (tests/evals) — real model calls, so NOT part of `npm test`.
// Run with `npm run agent:eval` (reads ANTHROPIC_API_KEY from the environment / .env).
export default defineConfig({
    resolve: { alias: { "@": path.resolve(__dirname, ".") } },
    test: {
        environment: "node",
        include: ["tests/evals/**/*.eval.ts"],
        globals: true,
        // ANTHROPIC_API_KEY etc. from .env (all keys, not only VITE_*).
        env: loadEnv("", process.cwd(), ""),
        testTimeout: 180_000,
        hookTimeout: 60_000,
        fileParallelism: false,
        reporters: ["default"],
    },
});
