# Import Feature Plan

Prepared by Catie He · PRISM LCA (tiangong-simple) · 2026-09-13

Adding dataset import to the live app: two tracks — plain JSON and EcoSpold v2
XML — for bringing outside life-cycle data into the Supabase-backed catalog,
entirely from the browser. Also published as a formatted page:
https://claude.ai/code/artifact/77f23a08-75ab-4518-9746-6103623361da

## Where this fits

PRISM LCA is a static site: React + Vite, deployed to GitHub Pages, with no
server of its own. Every write already happens the same way — a signed-in
browser session talks to Supabase directly through `supabase-js`, and Row
Level Security decides what that session is allowed to do. The dataset forms
(`ProcessForm.tsx`, `FlowForm.tsx`, etc.) already prove this pattern works for
hand-entered data.

The reverse trip already exists, just not in the app: `scripts/export_ecospold.py`
and `scripts/export_tidas.py` pull rows out of the `datasets` table and write
EcoSpold / TIDAS XML, run locally with Python. This plan is the missing return
trip — reading outside files back in — built as a feature of the deployed app
itself, not a script someone has to run offline.

| Track | Source format | New code | Main risk | Rough effort |
|---|---|---|---|---|
| A — JSON | This app's own `{type, name, description, payload}` shape | Validate + bulk insert | Low — shape is fully known | 0.5–1 day |
| B — EcoSpold | `<ecoSpold>` v2 XML, one `<activityDataset>` per process | XML walk + name-matching + review screen | High — IDs won't match existing rows | 3–5 days |

## Track A — JSON import

Input: a `.json` file — one dataset object or an array of them, matching the
`Dataset` type already defined in `src/lib/datasets.ts`.

1. **Bulk write helper.** Add `createDatasets(rows: NewDataset[])` next to the
   existing single-row `createDataset()` in `src/lib/datasets.ts` — same
   auth-gated Supabase insert, just batched.
2. **File picker.** An "Import" entry point (dialog, or a route like
   `/open-data/:type/import`) that reads a local `.json` file with
   `file.text()` — nothing leaves the browser until the user confirms.
3. **Validate per row.** Each record needs a `type` that matches one of
   `DATASET_TYPES`, a non-empty `name`, and a `payload` object. Bad rows get
   flagged individually rather than failing the whole file.
4. **Dry-run preview.** Show what will be created — name, type, a short
   payload summary — before anything touches Supabase.
5. **Commit and report.** Insert via `createDatasets()`; show which rows
   succeeded and which failed (a constraint violation shouldn't sink the whole
   batch).

## Track B — EcoSpold import

Input: a `.spold` / `.xml` file, structured the way `scripts/export_ecospold.py`
already writes it — which makes that script the field-mapping reference.

1. **Parse in the browser.** Use the built-in `DOMParser` (`application/xml`)
   — no library needed, works entirely client-side.
2. **Walk each activity.** Pull process-level fields (`activityName`,
   `geography`, `timePeriod`) and the `<exchange>` list off each
   `<activityDataset>` — the mirror of what the exporter writes out.
3. **Match, don't assume.** The exporter's UUIDs are its own generated
   (`uuid5`) IDs and won't match anything already in Supabase. Match incoming
   flows / unit groups to existing rows *by name* first; only create new
   `flow` / `unit_group` / `flow_property` rows when nothing matches.
4. **Rebuild the graph.** Turn each exchange's `activityLinkId` back into a
   `model`-type dataset — the same process-linking graph shape the exporter
   reads from.
5. **Human review before commit.** Because step 3 is a heuristic, show
   matched-vs-new decisions per flow and let the user correct them — this
   track can't go straight to Supabase the way Track A can.
6. **Bound the scope.** Support the subset of EcoSpold v2 the exporter itself
   produces (documented fields only). Full-spec EcoSpold is a much larger
   effort and a deliberate non-goal here.

## Constraints both tracks share

- **No server to lean on.** GitHub Pages serves static files only — every
  byte of parsing happens in the visitor's own browser tab, with no middle
  tier to validate or transform first.
- **Same write path as today.** Both tracks reuse the existing authenticated
  `supabase-js` session and RLS policies the dataset forms already depend on.
  Importing while signed out should fail the same way creating a dataset by
  hand already does.
- **Partial failure is normal.** A 40-row import with 3 malformed rows should
  commit the other 37 and report the 3 — not abort the batch.
- **Large files live in memory.** A big EcoSpold export is parsed entirely in
  the tab's memory. Worth testing against a realistically large file early
  rather than assuming it scales.
- **No undo in v1.** Neither track rolls back a bad import yet — a known gap
  to flag, not something to quietly skip.

## Suggested order

1. Shared: `createDatasets()` bulk helper + import UI shell (file picker,
   auth gate)
2. Track A: JSON validation, preview, commit — usable on its own once done
3. Track B: DOMParser walk + field mapping against `export_ecospold.py`
4. Track B: name-based flow / unit-group matching + review screen
5. Track B: model-graph reconstruction from `activityLinkId`
6. Shared: per-row error reporting polish + README documentation

**Why split it this way:** Track A ships fast and is immediately useful — it
only has to trust a shape this app already owns. Track B is the harder,
genuinely interesting problem: reading a real interchange format back into a
graph, with no server-side safety net, which is why it gets a mandatory
review step that Track A doesn't need.
