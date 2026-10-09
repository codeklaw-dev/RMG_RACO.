"use client";
import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { ChipCheckboxGroup, ChipRadioGroup } from "@/components/studio/controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { detectConflicts } from "@/lib/brand/intelligence";
import { CONSTRUCTION_DETAILS } from "@/lib/brand/vocabulary";
import { MATERIALS, SILHOUETTES } from "@/lib/types/domain";
import type { BrandRule, RuleCategory, RuleEffect, RuleKind, RulePriority } from "@/lib/types/brand";
import { cn } from "@/lib/utils";
import { SaveBar, SectionHeader, TextField, useEditable, useSectionForm } from "./shared";

type EffectType = RuleEffect["type"];

const EFFECTS: { value: EffectType; label: string; kind?: RuleKind }[] = [
  { value: "prefer_silhouette", label: "Prefer silhouettes", kind: "positive" },
  { value: "avoid_silhouette", label: "Avoid silhouettes", kind: "negative" },
  { value: "prefer_material", label: "Prefer materials", kind: "positive" },
  { value: "avoid_material", label: "Avoid materials", kind: "negative" },
  { value: "prefer_detail", label: "Prefer construction details", kind: "positive" },
  { value: "avoid_detail", label: "Avoid construction details", kind: "negative" },
  { value: "avoid_colour", label: "Avoid colours", kind: "negative" },
  { value: "palette_only", label: "Approved palette only", kind: "negative" },
  { value: "guidance", label: "Guidance only (not evaluated)" },
];

const CATEGORY_FOR: Partial<Record<EffectType, RuleCategory>> = {
  prefer_silhouette: "silhouette", avoid_silhouette: "silhouette", prefer_material: "material", avoid_material: "material",
  prefer_detail: "construction", avoid_detail: "construction", avoid_colour: "colour", palette_only: "colour",
};

export const describeEffect = (e: RuleEffect) =>
  e.type === "guidance" ? "Guidance only — carried as text, not evaluated" : e.type === "palette_only" ? "Colours must come from the approved palette" : `${EFFECTS.find((x) => x.value === e.type)?.label}: ${e.values.join(", ") || "—"}`;

function blankRule(kind: RuleKind): BrandRule {
  const now = new Date().toISOString();
  return {
    id: `rule_${Date.now().toString(36)}`,
    kind,
    title: "",
    description: "",
    category: "general",
    priority: "medium",
    enabled: true,
    approval: "pending",
    effect: { type: "guidance" },
    sourceReferenceIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function RuleDialog({ rule, onSave, onClose }: { rule: BrandRule; onSave: (r: BrandRule) => void; onClose: () => void }) {
  const { content } = useEditable();
  const [r, setR] = useState(rule);
  const values = "values" in r.effect ? (r.effect.values as string[]) : [];
  const setEffect = (type: EffectType) =>
    setR({ ...r, category: CATEGORY_FOR[type] ?? r.category, effect: type === "guidance" || type === "palette_only" ? { type } : ({ type, values: [] } as RuleEffect) });
  const setValues = (vals: string[]) => setR({ ...r, effect: { ...r.effect, values: vals } as RuleEffect });
  const options =
    r.effect.type.endsWith("silhouette") ? SILHOUETTES.map((v) => ({ value: v, label: v }))
    : r.effect.type.endsWith("material") ? MATERIALS.map((v) => ({ value: v, label: v }))
    : r.effect.type.endsWith("detail") ? CONSTRUCTION_DETAILS.map((v) => ({ value: v, label: v }))
    : r.effect.type === "avoid_colour" ? content.palette.map((c) => ({ value: c.hex.toUpperCase(), label: c.name }))
    : [];
  const invalid = !r.title.trim() || ("values" in r.effect && r.effect.values.length === 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-none sm:max-w-xl">
        <DialogTitle className="font-display text-2xl font-normal">{rule.title ? "Edit rule" : r.kind === "positive" ? "New rule" : "New exclusion"}</DialogTitle>
        <DialogDescription>Only the structured effect is evaluated. Title and description are carried for designers.</DialogDescription>
        <div className="space-y-4">
          <TextField label="Title" value={r.title} onChange={(title) => setR({ ...r, title })} />
          <TextField label="Description" value={r.description} onChange={(description) => setR({ ...r, description })} multiline />
          <fieldset className="space-y-2">
            <legend className="t-meta mb-2">Type</legend>
            <ChipRadioGroup name="kind" value={r.kind} options={[{ value: "positive", label: "Rule" }, { value: "negative", label: "Exclusion" }]} onChange={(kind) => setR({ ...r, kind, effect: (EFFECTS.find((x) => x.value === r.effect.type)?.kind ?? kind) === kind ? r.effect : { type: "guidance" } })} />
          </fieldset>
          <label className="block space-y-1.5">
            <span className="t-meta">Effect</span>
            <select value={r.effect.type} onChange={(e) => setEffect(e.target.value as EffectType)} className="h-9 w-full border border-hairline bg-card px-2 text-[13px]">
              {EFFECTS.filter((x) => !x.kind || x.kind === r.kind).map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </label>
          {options.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="t-meta mb-2">Applies to</legend>
              <ChipCheckboxGroup values={values} options={options} max={12} onChange={setValues} />
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-4">
            <fieldset className="space-y-2">
              <legend className="t-meta mb-2">Priority</legend>
              <ChipRadioGroup name="priority" value={r.priority} options={(["high", "medium", "low"] as RulePriority[]).map((v) => ({ value: v, label: v }))} onChange={(priority) => setR({ ...r, priority })} />
            </fieldset>
            <label className="block space-y-1.5">
              <span className="t-meta">Category</span>
              <select value={r.category} onChange={(e) => setR({ ...r, category: e.target.value as RuleCategory })} className="h-9 w-full border border-hairline bg-card px-2 text-[13px]">
                {(["silhouette", "material", "colour", "construction", "branding", "general"] as RuleCategory[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-none" onClick={onClose}>Cancel</Button>
            <Button className="rounded-none" disabled={invalid} onClick={() => onSave({ ...r, title: r.title.trim(), approval: "pending", updatedAt: new Date().toISOString() })}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RuleList({ kind, rules, all, setAll, locked, conflictIds, onEdit }: {
  kind: RuleKind; rules: BrandRule[]; all: BrandRule[]; setAll: (r: BrandRule[]) => void; locked: boolean; conflictIds: Set<string>; onEdit: (r: BrandRule) => void;
}) {
  const move = (id: string, dir: -1 | 1) => {
    const ids = rules.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const others = all.filter((r) => r.kind !== kind);
    setAll([...(kind === "positive" ? [] : others), ...ids.map((x) => all.find((r) => r.id === x)!), ...(kind === "positive" ? others : [])]);
  };
  const patch = (id: string, p: Partial<BrandRule>) => setAll(all.map((r) => (r.id === id ? { ...r, ...p, approval: "pending", updatedAt: new Date().toISOString() } : r)));

  return (
    <ol className="divide-y divide-hairline border-y border-hairline">
      {rules.map((r, i) => (
        <li key={r.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 py-3", !r.enabled && "opacity-55")}>
          <div className="flex flex-col">
            <Button variant="ghost" size="icon-xs" disabled={locked || i === 0} aria-label={`Move ${r.title} up`} onClick={() => move(r.id, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-xs" disabled={locked || i === rules.length - 1} aria-label={`Move ${r.title} down`} onClick={() => move(r.id, 1)}><ArrowDown /></Button>
          </div>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
              {r.title}
              {conflictIds.has(r.id) && <AlertTriangle aria-label="Conflict" className="size-3.5 text-oxblood" />}
            </p>
            <p className="t-meta mt-0.5">
              {r.category} · {r.priority} · {r.enabled ? "enabled" : "disabled"} · {r.approval === "approved" ? "approved" : "pending approval"}
            </p>
            {r.description && <p className="t-body mt-1 text-charcoal">{r.description}</p>}
            <p className="mt-1 text-[12px] text-muted-foreground">{describeEffect(r.effect)}</p>
          </div>
          <div className="flex items-center gap-1">
            <label className="flex items-center gap-1.5 text-[12px]">
              <input type="checkbox" disabled={locked} checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} className="accent-ink" aria-label={`Enable ${r.title}`} />
              <span className="hidden sm:inline">On</span>
            </label>
            <Button variant="ghost" size="icon-sm" disabled={locked} aria-label={`Edit ${r.title}`} onClick={() => onEdit(r)}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" disabled={locked} aria-label={`Delete ${r.title}`} onClick={() => setAll(all.filter((x) => x.id !== r.id))}><Trash2 /></Button>
          </div>
        </li>
      ))}
      {!rules.length && <li className="t-body py-4 text-muted-foreground">None yet.</li>}
    </ol>
  );
}

export function RulesSection() {
  const f = useSectionForm((c) => c.rules, (c, rules) => ({ ...c, rules }), "Creative rules");
  const { content } = useEditable();
  const [editing, setEditing] = useState<BrandRule | null>(null);
  const conflicts = detectConflicts({ ...content, rules: f.value });
  const conflictIds = new Set(conflicts.flatMap((c) => c.ids));
  const save = (r: BrandRule) => {
    f.setValue(f.value.some((x) => x.id === r.id) ? f.value.map((x) => (x.id === r.id ? r : x)) : [...f.value, r]);
    setEditing(null);
  };

  return (
    <div>
      <SectionHeader
        title="Creative rules"
        description="Rules and exclusions condition Brand and Hybrid requests once their version is approved. Each rule's structured effect is what the demo engine and consistency checks use."
      />
      {conflicts.length > 0 && (
        <div role="alert" className="mb-6 border-l-2 border-oxblood bg-oxblood-soft/60 px-4 py-3">
          <p className="t-meta text-oxblood">{conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected</p>
          <ul className="mt-1 space-y-0.5 text-[13px]">{conflicts.map((c) => <li key={c.message}>{c.message}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-10 xl:grid-cols-2">
        {(["positive", "negative"] as const).map((kind) => (
          <section key={kind} aria-label={kind === "positive" ? "Rules" : "Exclusions"}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="t-heading">{kind === "positive" ? "Rules" : "Exclusions"}</h3>
              <Button variant="outline" size="sm" className="rounded-none" disabled={f.locked} onClick={() => setEditing(blankRule(kind))}>
                <Plus /> Add {kind === "positive" ? "rule" : "exclusion"}
              </Button>
            </div>
            <RuleList kind={kind} rules={f.value.filter((r) => r.kind === kind)} all={f.value} setAll={f.setValue} locked={f.locked} conflictIds={conflictIds} onEdit={setEditing} />
          </section>
        ))}
      </div>
      {editing && <RuleDialog rule={editing} onSave={save} onClose={() => setEditing(null)} />}
      <SaveBar dirty={f.dirty} locked={f.locked} onSave={f.save} onReset={f.reset} />
    </div>
  );
}
