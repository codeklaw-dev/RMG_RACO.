// Concept review workflow (simulated local action). Separate from Brand DNA
// approval and collection approval.
import type { ConceptStatus } from "@/lib/types/domain";

export type ReviewAction = "submit" | "approve" | "reject" | "reopen" | "archive" | "withdraw";

const TRANSITIONS: Record<ReviewAction, { from: ConceptStatus[]; to: ConceptStatus }> = {
  submit: { from: ["draft"], to: "in_review" },
  withdraw: { from: ["in_review"], to: "draft" },
  approve: { from: ["in_review"], to: "approved" },
  reject: { from: ["in_review"], to: "rejected" },
  reopen: { from: ["rejected", "archived"], to: "draft" },
  archive: { from: ["draft", "approved", "rejected"], to: "archived" },
};

export const REVIEW_LABEL: Record<ConceptStatus, string> = {
  draft: "Draft", in_review: "In review", approved: "Approved", rejected: "Rejected", archived: "Archived",
};

export const availableActions = (status: ConceptStatus) =>
  (Object.keys(TRANSITIONS) as ReviewAction[]).filter((a) => TRANSITIONS[a].from.includes(status));

export function reviewTransition(status: ConceptStatus, action: ReviewAction): ConceptStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(status)) throw new Error(`Cannot ${action} a ${REVIEW_LABEL[status].toLowerCase()} concept`);
  return t.to;
}
