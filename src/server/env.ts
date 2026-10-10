import "server-only";
// Server configuration, validated lazily on first use so builds never need secrets.
// Nothing here is ever sent to the browser.
import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const usd = z.coerce.number().nonnegative();

const schema = z.object({
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(3),
  S3_SECRET_ACCESS_KEY: z.string().min(8),
  S3_FORCE_PATH_STYLE: bool.default(false),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  RETENTION_CRON_SECRET: z.string().min(24),
  APP_ORIGIN: z.string().url(),
  INFERENCE_PROVIDER: z.enum(["none", "fake", "modal"]).default("none"),
  USER_HOURLY_GENERATION_LIMIT: z.coerce.number().int().positive().default(20),
  DEFAULT_ORG_MONTHLY_BUDGET_USD: usd.default(25),
  GLOBAL_MONTHLY_LIMIT_USD: usd.default(100),
  /** Conservative planning estimate per image until real costs are reported back. */
  COST_PER_IMAGE_USD: usd.default(0.02),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export class ConfigError extends Error {}

export function getEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cached && source === process.env) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Name the variables only; never echo their values.
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(", ");
    throw new ConfigError(`Server is not configured: missing or invalid ${names}`);
  }
  if (parsed.data.INFERENCE_PROVIDER === "fake" && source.NODE_ENV === "production") {
    throw new ConfigError("The fake inference provider is test-only");
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

/** Test hook. */
export function resetEnvCache() {
  cached = null;
}
