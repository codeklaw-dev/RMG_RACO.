// Server-side spend and rate decisions (pure). The caller supplies counts and
// sums from the database; this module only decides, so it is easy to test.
export interface LimitInput {
  imageCount: number;
  costPerImageUsd: number;
  userRequestsLastHour: number;
  userHourlyLimit: number;
  orgSpentThisMonthUsd: number;
  orgMonthlyBudgetUsd: number;
  globalSpentThisMonthUsd: number;
  globalMonthlyLimitUsd: number;
}

export type LimitDecision =
  | { ok: true; estimateUsd: number }
  | { ok: false; status: 429 | 402; code: "rate_limited" | "org_budget_exceeded" | "global_limit_reached"; message: string; estimateUsd: number };

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function decideLimits(i: LimitInput): LimitDecision {
  const estimateUsd = round4(i.imageCount * i.costPerImageUsd);
  if (i.userRequestsLastHour >= i.userHourlyLimit)
    return { ok: false, status: 429, code: "rate_limited", message: `Limit of ${i.userHourlyLimit} generation requests per hour reached`, estimateUsd };
  if (i.globalSpentThisMonthUsd + estimateUsd > i.globalMonthlyLimitUsd)
    return { ok: false, status: 402, code: "global_limit_reached", message: "The platform's monthly generation budget has been reached", estimateUsd };
  if (i.orgSpentThisMonthUsd + estimateUsd > i.orgMonthlyBudgetUsd)
    return { ok: false, status: 402, code: "org_budget_exceeded", message: "Your organisation's monthly generation budget has been reached", estimateUsd };
  return { ok: true, estimateUsd };
}

export const startOfMonthUtc = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
