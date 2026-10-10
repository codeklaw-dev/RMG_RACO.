import "server-only";
// Role → permission matrix. Checked on the server for every request.
import type { Role } from "@/generated/prisma/enums";

export type Permission = "asset.read" | "asset.upload" | "asset.delete" | "generation.create" | "job.read" | "job.cancel" | "usage.read" | "audit.read";

const MATRIX: Record<Role, Permission[]> = {
  owner: ["asset.read", "asset.upload", "asset.delete", "generation.create", "job.read", "job.cancel", "usage.read", "audit.read"],
  admin: ["asset.read", "asset.upload", "asset.delete", "generation.create", "job.read", "job.cancel", "usage.read", "audit.read"],
  designer: ["asset.read", "asset.upload", "asset.delete", "generation.create", "job.read", "job.cancel", "usage.read"],
  viewer: ["asset.read", "job.read", "usage.read"],
};

export const can = (role: Role, p: Permission) => MATRIX[role].includes(p);
