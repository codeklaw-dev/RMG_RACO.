// Server-side inference boundary. Real providers (Modal worker in 6C) implement
// this; until then the API runs with "none" and refuses to generate.
export interface InferenceSubmission {
  jobId: string;
  orgId: string;
  prompt: string;
  imageCount: number;
  referenceKeys: string[];
}

export interface InferenceProvider {
  readonly id: "none" | "fake" | "modal";
  readonly enabled: boolean;
  submit(s: InferenceSubmission): Promise<{ providerJobId: string }>;
  cancel(providerJobId: string): Promise<void>;
}
