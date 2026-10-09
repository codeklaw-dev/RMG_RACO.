// Read-side data access. Today: fixtures. Later: /api/v1 + Postgres.
// Every query is scoped by orgId, mirroring server-side tenant checks.
import { ASSETS, BRAND_PROFILE, COLLECTIONS, CONCEPTS } from "@/lib/fixtures";
import type { ID } from "@/lib/types/domain";

export const getBrandProfile = (orgId: ID) => (BRAND_PROFILE.orgId === orgId ? BRAND_PROFILE : null);
export const listCollections = (orgId: ID) => COLLECTIONS.filter((c) => c.orgId === orgId);
export const getCollection = (orgId: ID, id: ID) => listCollections(orgId).find((c) => c.id === id) ?? null;
export const listAssets = (orgId: ID) => ASSETS.filter((a) => a.orgId === orgId);
export const listSeedConcepts = (orgId: ID) => CONCEPTS.filter((c) => c.orgId === orgId);
