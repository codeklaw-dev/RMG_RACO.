import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "./env";

const g = globalThis as unknown as { raco_prisma?: PrismaClient };

/** Lazily created Prisma client (one per server instance / dev hot-reload). */
export function db(): PrismaClient {
  g.raco_prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
  return g.raco_prisma;
}

/** Tests: swap or reset the client. */
export function setDb(client: PrismaClient | undefined) {
  g.raco_prisma = client;
}
