// Feature flags. Disabling a module hides it from navigation without breaking routes.
export const FLAGS = {
  virtualTryOn: process.env.NEXT_PUBLIC_FLAG_TRY_ON !== "false",
  technicalDevelopment: true,
} as const;
