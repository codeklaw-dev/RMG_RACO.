// Pure version workflow. draft → in_review → approved; previous approved → archived.
// Approved snapshots are immutable: edits always land on a draft.
import type { BrandDNA, BrandProfileVersion, ProfileStatus } from "@/lib/types/brand";

export class VersionError extends Error {}

const now = () => new Date().toISOString();
const clone = <T,>(x: T): T => structuredClone(x);

export const latest = (vs: BrandProfileVersion[]) => vs.reduce<BrandProfileVersion | null>((a, v) => (!a || v.version > a.version ? v : a), null);
export const approvedVersion = (vs: BrandProfileVersion[]) => vs.find((v) => v.status === "approved") ?? null;
/** The single editable-or-pending version (draft or in review), if any. */
export const workingVersion = (vs: BrandProfileVersion[]) => vs.find((v) => v.status === "draft" || v.status === "in_review") ?? null;

function newDraftFrom(vs: BrandProfileVersion[], source: BrandProfileVersion, note: string, at = now()): BrandProfileVersion {
  const top = latest(vs)!;
  return {
    ...source,
    id: `${source.profileId}_v${top.version + 1}`,
    version: top.version + 1,
    status: "draft",
    content: clone(source.content),
    basedOnVersion: source.version,
    note,
    createdAt: at,
    updatedAt: at,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
  };
}

/** Return versions with a draft guaranteed; reuses an existing draft. */
export function ensureDraft(vs: BrandProfileVersion[]): { versions: BrandProfileVersion[]; draft: BrandProfileVersion; created: boolean } {
  const working = workingVersion(vs);
  if (working?.status === "draft") return { versions: vs, draft: working, created: false };
  if (working?.status === "in_review") throw new VersionError(`v${working.version} is in review. Return it to draft to edit.`);
  const base = approvedVersion(vs) ?? latest(vs);
  if (!base) throw new VersionError("No profile to edit");
  const draft = newDraftFrom(vs, base, `Edits on v${base.version}`);
  return { versions: [...vs, draft], draft, created: true };
}

export function editDraft(vs: BrandProfileVersion[], edit: (c: BrandDNA) => BrandDNA) {
  const { versions, draft, created } = ensureDraft(vs);
  const updated = { ...draft, content: edit(clone(draft.content)), updatedAt: now() };
  return { versions: versions.map((v) => (v.id === draft.id ? updated : v)), draft: updated, created };
}

function move(vs: BrandProfileVersion[], from: ProfileStatus, to: ProfileStatus, patch: Partial<BrandProfileVersion> = {}) {
  const target = vs.find((v) => v.status === from);
  if (!target) throw new VersionError(`No ${from.replace("_", " ")} version`);
  return vs.map((v) => (v.id === target.id ? { ...v, status: to, updatedAt: now(), ...patch } : v));
}

export const submitForReview = (vs: BrandProfileVersion[]) => move(vs, "draft", "in_review", { submittedAt: now() });
export const returnToDraft = (vs: BrandProfileVersion[]) => move(vs, "in_review", "draft", { submittedAt: null });

/** Simulated authorised approval. Archives the previously approved version. */
export function approve(vs: BrandProfileVersion[], approver: string) {
  const target = vs.find((v) => v.status === "in_review");
  if (!target) throw new VersionError("Only a version in review can be approved");
  const at = now();
  return vs.map((v) =>
    v.id === target.id
      ? {
          ...v,
          status: "approved" as const,
          approvedAt: at,
          approvedBy: approver,
          updatedAt: at,
          // Approving a version approves the rules it contains.
          content: { ...v.content, rules: v.content.rules.map((r) => ({ ...r, approval: "approved" as const })) },
        }
      : v.status === "approved"
        ? { ...v, status: "archived" as const, updatedAt: at }
        : v,
  );
}

export function discardDraft(vs: BrandProfileVersion[]) {
  const d = vs.find((v) => v.status === "draft");
  if (!d) throw new VersionError("No draft to discard");
  return vs.filter((v) => v.id !== d.id);
}

/** Copy an earlier version's content into a new draft (replacing any open draft). */
export function restoreAsDraft(vs: BrandProfileVersion[], version: number) {
  const source = vs.find((v) => v.version === version);
  if (!source) throw new VersionError(`v${version} not found`);
  if (vs.some((v) => v.status === "in_review")) throw new VersionError("Return the version in review to draft first");
  const without = vs.filter((v) => v.status !== "draft");
  const draft = newDraftFrom(without, source, `Restored from v${version}`);
  return { versions: [...without, draft], draft };
}
