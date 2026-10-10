import "server-only";
// Uniform JSON responses and error normalisation. Unexpected errors are logged
// server-side (redacted) and returned as a generic 500 — no stack traces,
// SQL, storage keys or secrets reach the client.
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ConfigError } from "./env";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const json = (body: unknown, init: ResponseInit = {}) =>
  NextResponse.json(body, { ...init, headers: { "Cache-Control": "no-store", ...(init.headers ?? {}) } });

const SECRET_PATTERN = /(postgres(ql)?:\/\/[^\s]+|X-Amz-Signature=[^&\s]+|secret[^\s]*|password[^\s]*)/gi;
export const redact = (s: string) => s.replace(SECRET_PATTERN, "[redacted]");

export function toResponse(err: unknown) {
  if (err instanceof ApiError) return json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } }, { status: err.status });
  if (err instanceof ZodError) {
    return json({ error: { code: "validation", message: err.issues[0]?.message ?? "Invalid request", fields: err.issues.map((i) => i.path.join(".")) } }, { status: 400 });
  }
  if (err instanceof ConfigError) {
    console.error("[config]", err.message);
    return json({ error: { code: "not_configured", message: "This service is not configured yet." } }, { status: 503 });
  }
  console.error("[api] unexpected error:", redact(err instanceof Error ? `${err.name}: ${err.message}` : String(err)));
  return json({ error: { code: "internal", message: "Something went wrong." } }, { status: 500 });
}

/** Wrap a route handler with error normalisation. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      return toResponse(e);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new ApiError(415, "unsupported_media_type", "Send JSON");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Malformed JSON body");
  }
  return schema.parse(raw);
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
