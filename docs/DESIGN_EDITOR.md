# Design Editor

Route: `/editor?concept=<conceptId>` (deep-linkable; opened from Studio, collection boards, Overview cards and lineage links). Unknown, removed or other-organisation ids show a recovery state.

## Layout
| Area | Contents |
|---|---|
| Navigator (left) | Concept search + status/collection filters · version timeline (prev/next, restore, variation) · lineage (source, parent, variations, collections) |
| Canvas (centre) | Schematic garment · zoom / fit / reset / pan (drag, ⌘/Ctrl + wheel) · front/back · before/after slider · annotation pins |
| Inspector (right) | Details (view / edit) · Refine · Brand · Notes (annotations) · Review |

Below 1280px the navigator and inspector become drawers. The canvas is DOM/SVG; React Konva wasn't needed for a single schematic and positioned pins, and DOM keeps pins keyboard- and screen-reader-accessible.

## Versioning
- `ConceptVersion` is immutable: id, conceptId, parentId, sequential `number`, summary, `changes`, `snapshot`, Brand DNA version (inherited from the concept), provenance, operation, timestamps. Annotations reference `versionId`.
- **Revision** = new version of the same concept (`manual`, `edit`, `restore`, `reopen`). **Variation** = new concept with `parentConceptId` and its own v1. Never conflated.
- Saving properties or confirming a refinement **appends** a version on top of the current head. Restoring copies an older snapshot into a **new** head version. `append()` rejects duplicate ids and parents from another concept.
- Snapshots are small metadata objects (no images) and are kept per version so restoration is exact.
- Approved and archived concepts are locked; continue via a variation, or archive → reopen.

## Rendering vs metadata
The schematic draws **silhouette, primary/accent colour and construction details** (plus seed-based marks). Title, description, fabric text, tags and notes are metadata only; the Details panel says so and nothing claims an image was regenerated.

## Annotations
`DesignAnnotation { conceptId, versionId, x, y (0–1), view, text, category, resolved }`. Coordinates are normalised to the artboard via `getBoundingClientRect()` (which includes zoom/pan), so pins stay put at any size. Keyboard alternative: “Add pin at centre”, arrow keys move a focused pin (Shift = 10%), and X/Y % inputs in the dialog.

## Conversational refinement
`lib/services/demo-edit.ts` is a deterministic interpreter over controlled vocabulary:
- silhouettes (+ boxy/slim/loose/fluid/“more structured”), materials (+ poplin/flannel/merino/satin/nylon), named colours (brand palette, curated, basics), construction details (+ “simplify the fastening”, “hidden placket”);
- replaced terms are ignored (“linen **instead of wool**”, “from navy to camel”);
- lower-third regions or words like “accent/trim” target the accent colour.
Anything else (sleeves, collars, pockets, hem length, prints…) is reported as **not available in the demo** and nothing changes. Accepted requests show a change preview, an optional canvas preview, then run as an `edit` job through `AIProvider.editConcept` → `getEditResult` → new version.

## Brand alignment
Reuses `evaluateConcept()` from Phase 3 on the viewed version, against either the Brand DNA version used to generate the concept or the current approved version. Enforceable rules show pass/fail with reasons; guidance rules are listed separately as not evaluated. Designers can document an **exception** (rule + reason, per version and profile version) — the profile is never modified. No similarity scores are invented.

## Future image editing
Replace the demo adapter's `editConcept` with an inpainting/instruction-editing provider: `region` → mask, `base` → source image asset, `instruction` → prompt; keep returning a `ConceptVersion` so the Editor and history stay unchanged.

## Known limitations
Schematic placeholders only · vocabulary-bound refinements · no real image editing, inpainting or GPU work · simulated approvals, no auth · single-user, browser-local persistence.
