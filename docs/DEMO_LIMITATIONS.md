# Demo Limitations (implemented behaviour)

| Area | Limitation |
|---|---|
| Generation | Deterministic seeded synthesis of schematic concepts; no image model |
| Brand intelligence | Structured profile + rule checks on recorded attributes; guidance rules not scored; no embeddings, retrieval or LoRA |
| Refinement | Controlled vocabulary only (silhouette, material, named colour, construction detail); others refused |
| Imagery | Schematic SVG garments and avatars; metadata-only edits don't change drawings |
| Try-on | Schematic composite; not physically accurate; no fit, drape or measurement |
| Technical brief | Concept-stage; measurements blank unless entered; not a production tech pack |
| Approvals | Brand, concept, collection and technical approvals are simulated local actions; no authentication |
| Persistence | Browser localStorage (metadata only); single user; reference images live in the tab only |
| References | Uploaded images aren't analysed or uploaded; unavailable after reload until re-attached |
| Export | PDF generated locally in the browser |
