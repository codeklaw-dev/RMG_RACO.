// Single source of truth for what the demo really does. The Pilot Readiness
// screen renders from this; tests check it against the running adapter and
// routes so a button existing never makes a feature "functional".
import type { AIProvider } from "@/lib/services/ai-provider";
import { FLAGS, type FlagName } from "./flags";

export type CapabilityStatus = "functional" | "simulated" | "production_required";

export interface Capability {
  id: string;
  label: string;
  status: CapabilityStatus;
  detail: string;
  /** Route where it can be seen in the demo (functional/simulated only). */
  route?: string;
  flag?: FlagName;
}

export const STATUS_COPY: Record<CapabilityStatus, { title: string; blurb: string }> = {
  functional: { title: "Functional in the demo", blurb: "Real, working behaviour in the browser (local persistence)." },
  simulated: { title: "Simulated", blurb: "Deterministic stand-ins, clearly labelled. No model inference." },
  production_required: { title: "Production integrations required", blurb: "Needed for the pilot; not present in the demo." },
};

export function capabilityRegistry(provider: Pick<AIProvider, "info">): Capability[] {
  // AI-backed features are only "functional" if a live provider is configured.
  const ai: CapabilityStatus = provider.info.capability === "live" ? "functional" : "simulated";
  const all: Capability[] = [
    { id: "collections", label: "Design organisation & collections", status: "functional", detail: "Boards, ordering (drag + keyboard), groups, notes, filters", route: "/collections" },
    { id: "brand-editing", label: "Brand profile editing & versioning", status: "functional", detail: "Draft → review → approved, immutable snapshots, compare, restore", route: "/brand-dna" },
    { id: "brand-checks", label: "Rule-based brand consistency checks", status: "functional", detail: "Deterministic checks on recorded attributes; guidance rules not scored", route: "/editor" },
    { id: "version-history", label: "Version history & lineage", status: "functional", detail: "Immutable versions, restore as new, variations as linked concepts", route: "/editor" },
    { id: "annotations", label: "Design annotations", status: "functional", detail: "Normalised pins per version, keyboard placement", route: "/editor" },
    { id: "reviews", label: "Creative, collection & technical review workflows", status: "functional", detail: "Local simulated roles; no authentication", route: "/collections" },
    { id: "tech-brief", label: "Technical brief editing & PDF export", status: "functional", detail: "Specs, measurements (cm/in), BOM, missing-info warnings", route: "/technical", flag: "technicalDevelopment" },
    { id: "presentation", label: "Collection presentation mode", status: "functional", detail: "Keyboard-driven client presentation", route: "/collections" },
    { id: "generation", label: "Garment concept generation", status: ai, detail: "Seeded synthesis of schematic concepts from the brief", route: "/studio" },
    { id: "brand-synthesis", label: "Brand-aware design synthesis", status: ai, detail: "Approved Brand DNA constrains the deterministic engine", route: "/studio" },
    { id: "refinement", label: "Conversational refinements", status: ai, detail: "Controlled-vocabulary interpreter; unsupported requests refused", route: "/editor" },
    { id: "try-on", label: "Conceptual virtual try-on", status: ai, detail: "Schematic avatar + garment composite; not physically accurate", route: "/try-on", flag: "virtualTryOn" },
    { id: "img-gen", label: "Real image generation", status: "production_required", detail: "FLUX/SDXL-class models via ComfyUI/Diffusers or hosted API" },
    { id: "img-edit", label: "Image editing & inpainting", status: "production_required", detail: "Region masks from the Editor drive inpainting" },
    { id: "retrieval", label: "Brand reference retrieval", status: "production_required", detail: "Embeddings (CLIP/SigLIP) + pgvector over approved references" },
    { id: "lora", label: "Optional LoRA training", status: "production_required", detail: "Only with licensed, consistent brand datasets" },
    { id: "vton", label: "Virtual try-on inference", status: "production_required", detail: "FASHN / IDM-VTON / CatVTON after licence review" },
    { id: "storage", label: "Secure cloud storage", status: "production_required", detail: "Private S3-compatible buckets, signed uploads" },
    { id: "auth", label: "Authentication & roles", status: "production_required", detail: "Org-scoped RBAC for designers, directors, technical leads" },
    { id: "db", label: "Database persistence", status: "production_required", detail: "PostgreSQL + Prisma replacing browser storage" },
    { id: "gpu", label: "GPU job orchestration", status: "production_required", detail: "Queue + autoscaling GPU workers, cost controls" },
    { id: "monitoring", label: "Production monitoring", status: "production_required", detail: "Errors, latency, cost per accepted concept, audit trail" },
  ];
  return all.filter((c) => !c.flag || FLAGS[c.flag]);
}
