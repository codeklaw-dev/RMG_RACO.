"use client";
// Small accessible form primitives for the brief panel. Native inputs keep
// keyboard behaviour (arrow keys in radio groups, space on checkboxes) for free.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="t-meta mb-2 flex w-full items-baseline justify-between">
        <span>{label}</span>
        {hint && <span className="normal-case tracking-normal">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

const chip =
  "inline-flex h-7 cursor-pointer items-center border border-hairline bg-card px-2.5 text-[12px] text-charcoal transition-colors select-none hover:border-stone peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-40";

export function ChipRadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
          <span className={chip}>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function ChipCheckboxGroup<T extends string>({
  values,
  options,
  max,
  onChange,
}: {
  values: T[];
  options: { value: T; label: string }[];
  max: number;
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const checked = values.includes(o.value);
        return (
          <label key={o.value}>
            <input
              type="checkbox"
              checked={checked}
              disabled={!checked && values.length >= max}
              onChange={() => onChange(checked ? values.filter((v) => v !== o.value) : [...values, o.value])}
              className="peer sr-only"
            />
            <span className={chip}>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function Swatch({
  hex,
  name,
  checked,
  disabled,
  onChange,
}: {
  hex: string;
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label title={name}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="peer sr-only" aria-label={name} />
      <span
        className="block size-7 cursor-pointer border border-black/10 ring-offset-2 ring-offset-paper transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-25"
        style={{ background: hex }}
      />
    </label>
  );
}
