import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "backend",
    root: __dirname,
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    // Each file boots its own in-memory MongoDB; run files sequentially to keep memory/CPU sane.
    fileParallelism: false,
    // The default "forks" pool intermittently fails on Windows with ERR_IPC_CHANNEL_CLOSED
    // when a worker exits after stopping mongod; worker threads avoid the IPC channel.
    pool: "threads",
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-for-vitest-only-0123456789abcdef",
      SEED_DEMO_DATA: "false",
      RATE_LIMIT_ENABLED: "false",
      EXTERNAL_CATALOG_ENABLED: "false",
      FRONTEND_URL: "http://localhost:8080",
      LOG_LEVEL: "silent",
    },
  },
});
