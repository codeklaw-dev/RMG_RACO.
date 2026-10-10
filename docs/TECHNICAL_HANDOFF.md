# Technical Handoff

Route: `/technical` (list + create) and `/technical?brief=<id>` (flag `NEXT_PUBLIC_FLAG_TECHNICAL`). Purpose: turn a concept **version** into a **Preliminary Garment Development Brief**. It is not a production tech pack, CAD pattern or BOM system.

## Brief contents (`TechBrief`)
- **Overview** (read-only from the version): garment, concept id, version, collection, category, silhouette, materials, palette, Brand DNA version, creative review status, designer notes.
- **Construction** (11 editable fields). Prefill uses recorded metadata only — description, closure and hem from the controlled construction vocabulary, fabric list — and each prefilled field is tagged “from concept metadata — verify”. Everything else starts blank.
- **Measurements**: chest, shoulder, body length (required), sleeve, waist, hem (optional); add/remove rows. Values start **blank**; an “illustrative” flag marks placeholders. Stored in centimetres; cm/in toggle converts for display (÷/× 2.54). Validation: 0 < value ≤ 400 cm, tolerance ≥ 0 and < value.
- **Materials & trims** (BOM-style): component, material, colour, quantity, unit, supplier notes, status (unspecified / proposed / confirmed).
- **Drawings**: front/back schematic views, labelled conceptual illustrations, not patterns.
- **Open items**: computed missing-information list.

## Technical review (separate from creative approval)
Draft → Ready for technical review → Changes requested | Reviewed; Changes requested → resubmit; Reviewed → reopen. Editing is locked while in review or reviewed. Each transition is recorded with note, simulated actor (“Technical lead (simulated role)”) and time. Nothing promotes a concept to production readiness.

## Export
**Export PDF** builds a `BriefDocument` (`buildBriefDocument`, pure and tested) and renders it with **jsPDF** (MIT, lazily imported so it only loads on export). The PDF contains: title “Preliminary Garment Development Brief”, the disclaimer “Concept-stage document. Measurements, construction, fit, and production feasibility require professional validation.”, identification, concept/version reference, overview, rasterised schematic views, construction, measurements, materials, review history, provenance and date, missing-information warnings, and a footer stating it is not a production tech pack.

### PDF rendering details (validated in Chromium's PDF viewer)
- Text uses jsPDF's built-in Helvetica/Times (WinAnsi). `pdfSafe()` keeps WinAnsi typography (— “ ” ± ½ • … accented Latin), maps common symbols (→ ★ ≤ ≥ ×) to ASCII, and replaces anything else (e.g. CJK, Greek) with “?”, adding a warning to the PDF.
- Real line heights; labels wrap inside a 46 mm column; long fields flow line by line across pages with “(continued)” headings; the disclaimer box sizes to its text; warnings wrap and continue across pages.
- Compression is on (stress brief with drawings ≈ 27 KB in Chromium, down from 1.35 MB).
- Layout regression tests assert every drawn line stays inside the page width and body area.
