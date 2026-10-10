// Read-side data access. Today: fixtures. Later: /api/v1 + Postgres.
// Every query is scoped by orgId, mirroring server-side tenant checks.
import { COLLECTIONS, CONCEPTS } from "@/lib/fixtures";
import type { ID } from "@/lib/types/domain";

export const listCollections = (orgId: ID) => COLLECTIONS.filter((c) => c.orgId === orgId);
export const getCollection = (orgId: ID, id: ID) => listCollections(orgId).find((c) => c.id === id) ?? null;
export const listSeedConcepts = (orgId: ID) => CONCEPTS.filter((c) => c.orgId === orgId);
