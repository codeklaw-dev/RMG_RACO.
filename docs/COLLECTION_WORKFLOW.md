# Collection Workflow

## Board (`/collections/[id]`)
- **Structure:** title, season, description, creative direction, collection notes, review status, last updated, ordered looks, design-direction groups, per-look note/tags/group.
- **Organise:** add concepts (org-scoped picker), remove, drag-and-drop reorder (dnd-kit, keyboard sensor: Space to lift, arrows to move), and explicit Earlier/Later buttons so dragging is never required. Order = presentation order.
- **Overview:** palette summary weighted by use, look counts, filters by review status and tag.

## Three separate approvals (all simulated, no real auth)
| Workflow | Where | States |
|---|---|---|
| Brand DNA version | Brand DNA | draft → in review → approved (→ archived) |
| Concept review | Editor › Review, look cards | draft → in review → approved / rejected; approved/draft/rejected → archived; rejected/archived → reopen (new draft version) |
| Collection review | Board header | concept → in review → approved |

Each concept transition is stored as a `DesignReview` (from, to, note, version, actor, time) and shown as history.

## Presentation (`/present/[id]`)
Full-screen dark layout outside the app shell: intro (name, season, creative direction, palette), one slide per look (large schematic, description, silhouette, materials, palette, status, optional notes with **N**), closing slide. ← → / Space / PageUp/Down / Home / End, **Esc** or the Exit button returns to the board. No editing controls or raw data; the “Simulated · schematic placeholders” label stays visible.

## Data rules
Looks are concept ids (no copies); membership is unique per collection; cross-organisation saves are refused; removing a look keeps the concept and its history; everything persists in `raco-studio` (v5) with migration from earlier versions.
