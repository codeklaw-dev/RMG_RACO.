// Prisma 7 configuration. Loads local env files when present (no dotenv dependency).
import { defineConfig } from "prisma/config";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file absent: rely on the process environment (CI, Vercel)
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
