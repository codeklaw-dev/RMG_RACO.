// Feature flags. Disabling a module hides it from navigation and the guided
// demo, and its route returns 404 — nothing else breaks.
export const FLAGS = {
  virtualTryOn: process.env.NEXT_PUBLIC_FLAG_TRY_ON !== "false",
  technicalDevelopment: process.env.NEXT_PUBLIC_FLAG_TECHNICAL !== "false",
  guidedDemo: process.env.NEXT_PUBLIC_FLAG_DEMO !== "false",
} as const;

export type FlagName = keyof typeof FLAGS;
