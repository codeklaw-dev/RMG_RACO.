// Database + object-storage tests (Phase 6 Track B). Needs the local services:
//   npm run db:up && npm run test:integration
// Uses a separate database (raco_test) and bucket (raco-test); never the dev data.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./src/test/db-global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://raco:raco_local_dev@127.0.0.1:54329/raco_test",
      S3_ENDPOINT: "http://127.0.0.1:8333",
      S3_REGION: "us-east-1",
      S3_BUCKET: "raco-test",
      S3_ACCESS_KEY_ID: "raco_local",
      S3_SECRET_ACCESS_KEY: "raco_local_secret",
      S3_FORCE_PATH_STYLE: "true",
      AUTH_SECRET: "test-only-auth-secret-0123456789abcdefghijklmnop",
      RETENTION_CRON_SECRET: "test-only-retention-secret-0123456789",
      APP_ORIGIN: "http://localhost:3000",
      INFERENCE_PROVIDER: "fake",
      USER_HOURLY_GENERATION_LIMIT: "20",
      GLOBAL_MONTHLY_LIMIT_USD: "100",
      COST_PER_IMAGE_USD: "0.02",
    },
  },
});
