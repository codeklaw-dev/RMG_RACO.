import "server-only";
import { getEnv } from "../env";
import type { InferenceProvider } from "./types";

const none: InferenceProvider = {
  id: "none",
  enabled: false,
  submit: async () => { throw new Error("inference disabled"); },
  cancel: async () => {},
};

/** Test-only provider (rejected in production by env validation). Records calls, never runs a model. */
export const fakeCalls: { submitted: string[]; canceled: string[] } = { submitted: [], canceled: [] };
const fake: InferenceProvider = {
  id: "fake",
  enabled: true,
  submit: async (s) => { fakeCalls.submitted.push(s.jobId); return { providerJobId: `fake_${s.jobId}` }; },
  cancel: async (id) => { fakeCalls.canceled.push(id); },
};

export function inferenceProvider(): InferenceProvider {
  const id = getEnv().INFERENCE_PROVIDER;
  if (id === "fake") return fake;
  // "modal" is wired in milestone 6C after Track A validation, legal review and approval.
  return none;
}
