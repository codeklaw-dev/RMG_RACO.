// Single entry point the UI uses. Swap the adapter here (or via env on the
// server) to move from SIMULATED to LIVE without touching components.
import type { AIProvider } from "./ai-provider";
import { DemoAIAdapter } from "./demo-adapter";

let provider: DemoAIAdapter | null = null;

export function getAIProvider(): AIProvider & Pick<DemoAIAdapter, "listJobs"> {
  provider ??= new DemoAIAdapter();
  return provider;
}

export * from "./ai-provider";
export * as repo from "./repository";
