import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for our own logic (billing / licence / auth-gated routes). The
// route handlers are exercised through their exported functions with Prisma and
// getCurrentUser mocked — no live DB. See AGENT_TESTING.md.
export default defineConfig({
    // Mirror tsconfig's "@/*" -> repo root, without an ESM-only plugin.
    resolve: { alias: { "@": path.resolve(__dirname, ".") } },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        globals: true,
    },
});
