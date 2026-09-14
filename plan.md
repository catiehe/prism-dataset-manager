# PRISM LCA — Plan

Single running plan for this repo. Supersedes the old `plan.md` (2026-09-07) and
`plan-0908.md` (2026-09-08), which are now folded in below as dated sections —
**do not create new plan-YYYYMMDD.md files going forward, keep appending here.**
Each section is marked with its status. See `WORKLOG.md` for the detailed
session-by-session log; this file is the forward-looking plan + a compressed
history of what shipped.

Status legend: ✅ done · 🚧 in progress · 🔜 not started

---

## 2026-09-07 — Initial scaffold ✅ done

A minimal clone of the sidebar/data-browsing shell from
[tiangong-lca-next](https://github.com/linancn/tiangong-lca-next), deployed as a
static site to GitHub Pages with Supabase as the only backend. Stack lifted from
[calvinw/product-graph-editor](https://github.com/calvinw/product-graph-editor):
React 19 + Vite 6 + TS + Tailwind v4 + shadcn/ui (`sidebar` block) + lucide-react
+ zustand + GitHub Actions Pages deploy, with `@supabase/supabase-js` added on
top.

Shipped: sidebar with 7 "Open Data" items (Models, Processes, Flows, Flow
Properties, Unit Groups, Sources, Contacts); one generic `datasets` table
(`type` + `payload` jsonb) with list/detail/add views shared across all 7 types;
magic-link auth gating the add form; `supabase/seed.sql` + `src/mock/datasets.json`
mock fallback; GitHub Actions deploy workflow. Live at
https://catiehe.github.io/tiangong-simple/.

## 2026-09-08 — Real auth + richer mock dataset ✅ done

1. **Magic-link auth, verified end to end.** Fixed `emailRedirectTo` to include
   the GH Pages base path (`window.location.origin + import.meta.env.BASE_URL`).
   User configured Supabase Auth's Site URL / Redirect URLs and confirmed a real
   emailed link signs in correctly, on both the Codespaces dev URL and the
   deployed site. Stretch fix done alongside: `dist/404.html` (copy of
   `index.html`) so GitHub Pages' no-rewrite behavior doesn't 404 direct links to
   non-root routes — `BrowserRouter` then handles it client-side.
2. **Richer mock dataset.** Expanded from 7 placeholder rows to 40
   cross-referenced rows (8 processes / 12 flows / 5 flow properties / 4 unit
   groups / 4 sources / 4 contacts / 3 models), ecoinvent/ILCD-style naming,
   including a full cotton t-shirt chain (fiber → weaving → dyeing → sewing →
   transport). `src/mock/datasets.json` and `supabase/seed.sql` kept byte-identical
   on ids/content. User ran the updated `seed.sql` against the live project;
   confirmed via REST that all 40 rows are live.

*(Note: between 2026-09-09 and 2026-09-10, per git history, a session not
recorded in this plan file added a structured Unit/Reference/Exchanges editor,
row Actions (View/Edit/Delete), and 18 more processes imported from lca-mcp
product graphs — bringing the mock dataset to 58 rows. Schema at that point was
still the flat `payload` shape below, not yet ILCD.)*

## 2026-09-11 — Adopt the real ILCD structure

The user shared a screenshot of the real TianGong app's "View process" modal
(`lca.tiangong.earth`) and asked to match tiangong-lca-next's actual data
structure — the ILCD (International Life Cycle Data) format — rather than the
flat `payload` shape used since 2026-09-07. Researched the real schema from
`linancn/tiangong-lca-next`'s `*_schema.json`/`demo.json`/form components for
all 6 non-Model sidebar types. Confirmed shared conventions across all of them:
a multi-language `{lang, text}` pattern for every label, a `{refObjectId, type,
shortDescription}` pattern for cross-dataset references, and common admin
metadata (`dataEntryBy`, `publicationAndOwnership`).

Scope decisions made with the user before starting:
- Skip the two large computed/workflow-output sections of Process (LCIA
  Results, the Validation review record) rather than build form UI for them —
  not something a person hand-authors.
- Roll out one type at a time, Process first, review before extending.

### Phase 1 — Process ✅ done (2026-09-11)

- `src/lib/ilcd.ts`: `LangText`, `DatasetRef`, `ProcessDataSet` types + a
  defensive `toProcessDataSet` normalizer (so partial/legacy payloads render
  instead of crashing).
- `src/components/ilcd/`: `LangTextField` (parallel English/简体中文 inputs),
  `DatasetRefField` (a `<Select>` sourced from `listDatasets()` of the target
  type, showing "(not found)" for an unresolved reference).
- `src/pages/ProcessForm.tsx` / `ProcessDetail.tsx`: 5-tab editor/viewer —
  Process information, Modelling and validation, Administrative information,
  Inputs and Outputs, Compliance declarations — matching the real app's tab
  layout minus the two skipped sections. `DatasetForm.tsx`/`DatasetDetail.tsx`
  dispatch to these for `type === "process"`; the other 6 types still use the
  original generic flat key/value editor, unchanged.
- Migrated all 26 existing process rows (`src/mock/datasets.json` +
  `supabase/seed.sql`) from the old flat exchange shape into the new one. The
  original 8 fully resolve against real Flow/Source records (with a starred
  reference-flow row); the 18 lca-mcp-imported ones mostly reference
  flows/sources that were never seeded as their own records — preserved as
  free-text `shortDescription` rather than fabricating fake links.
- Verified via a headless-Chromium smoke test (list, tabbed detail view,
  tabbed edit form) against both the mock-data fallback and the live Supabase
  project.

**⚠️ Outstanding action for the user:** the live Supabase project still has the
old flat exchange shape for `process` rows — **re-run the updated
`supabase/seed.sql`** in the Supabase SQL editor before the deployed site's
Processes will render correctly. Confirmed via testing that this is exactly
what's broken right now (process pages render mostly blank against live data
pre-reseed); the other 6 types are unaffected since their shape hasn't changed
yet.

### Phase 2 — Flow, Flow Property, Unit Group, Source, Contact ✅ done (2026-09-11)

Same treatment as Process, reusing `LangTextField` / `DatasetRefField` / the
normalizer pattern in `src/lib/ilcd.ts`. Built simplest-to-most-complex —
Contact → Source → Unit Group → Flow Property → Flow — each as a `*Form.tsx`/
`*Detail.tsx` pair (`ContactForm`/`ContactDetail`, `SourceForm`/`SourceDetail`,
`UnitGroupForm`/`UnitGroupDetail`, `FlowPropertyForm`/`FlowPropertyDetail`,
`FlowForm`/`FlowDetail`), dispatched from `DatasetForm.tsx`/`DatasetDetail.tsx`
the same way Process is. Extracted the inline `LangRow` display helper out of
`ProcessDetail.tsx` into `src/components/ilcd/lang-row.tsx` since all 6 detail
pages now need it. `src/lib/ilcd.ts` grew a `SharedAdministrativeInformation`
type (the dataEntryBy/publicationAndOwnership fields common to all 5 of these
types, since none of them have Process's commissioner/dataGenerator/copyright/
licenseType extras) plus defensive normalizers per type, same pattern as
Process's `normalizeExchanges`.

Migrated all existing mock/seed rows for these 5 types (4 contacts, 4 sources,
4 unit groups, 5 flow properties, 12 flows — 29 rows) into the new shapes.
Cross-references resolved cleanly since this data was already hand-authored to
be consistent: all 4 flow-property→unit-group refs and all 12 flow→flow-property
refs resolved; only one source→contact ref stayed unresolved (ISO 14040:2006's
publisher has no matching Contact record — correctly preserved as free text,
not fabricated). Verified via a headless-Chromium smoke test (list + detail for
all 5 types, zero console errors) against the mock-data fallback, and edit-form
rendering verified against a real Supabase-configured build (session gate
bypassed for the test only, reverted immediately after).

**Same outstanding action as Phase 1**: the live Supabase project needs
`supabase/seed.sql` re-run for these 5 types too, same as Process.

Per the 2026-09-11 schema research, the field-level shape per type:

- **Flow** (3 tabs: Flow information / Modelling and validation /
  Administrative information). Key structural piece: a repeatable
  `flowProperties[]` list — a flow can carry multiple properties (e.g. Mass +
  Net calorific value), each with a `meanValue` conversion factor and a
  `referenceToFlowPropertyDataSet` ref; `quantitativeReference` points at
  which entry is the flow's native/reference property. Also carries
  `CASNumber`/`sumFormula` (for elementary/substance flows) and a
  `typeOfDataSet` enum (Elementary / Product / Waste flow).
- **Flow Property** (3 tabs, simplest of the reference types): single
  `common:name` LangString, `referenceToReferenceUnitGroup` (ref to a Unit
  Group — this is what actually defines the property's unit).
- **Unit Group** (3 tabs + a `units[]` list): each unit row is `{name: plain
  string (not LangText, e.g. "kg"), meanValue: conversion factor relative to
  the reference unit}`; `referenceToReferenceUnit` is an int pointing at which
  unit row is the reference (factor 1.0).
- **Source** (2 tabs, closer to a citation record): `common:shortName`
  (display name), `sourceCitation` (free text), `publicationType` enum,
  `referenceToContact` (ref to a Contact), `referenceToDigitalFile`.
- **Contact** (2 tabs, closest to a plain address-book entry): `common:shortName`
  + `common:name`, `email`/`WWWAddress`/`telephone`/`contactAddress`,
  `referenceToContact[]` (repeatable — an org can link to its individual staff
  contacts).

**Model is explicitly excluded from this phase** — see Phase 3.

### Phase 3 — Model: external link + Edit + ILCD format ✅ done (2026-09-11)

Three separate asks, in order:

1. ✅ **Done.** Added a "Product Graph Editor" button on the Models list page
   (`DatasetList.tsx`, shown only when `typeInfo.type === "model"`), an
   external link to https://github.com/calvinw/product-graph-editor opening
   in a new tab. Verified with a headless-Chromium screenshot at both desktop
   and mobile widths.
2. ✅ **Done — turned out to already work, no new code needed.** Verified
   `/open-data/model/:id/edit` was already reachable and rendering correctly
   through the existing generic `DatasetForm` (Models never got a specialized
   form/detail pair in Phase 1-2, so it still uses the original flat
   name/description/key-value editor) — confirmed via a headless-Chromium
   test (session gate bypassed for the test only, reverted immediately after).
3. ✅ **Done.** Researched the real "Life Cycle Model" (`lifeCycleModelDataSet`)
   structure via a research fork, scoped to the document shape only — not the
   real app's visual X6Graph flowchart editor or its matrix-solving
   calculation engine, both explicitly out of scope. Key finding:
   `technology.processes.processInstance[]` is the graph — each instance
   references a real Process dataset (the same `DatasetRef` pattern already
   used everywhere) plus a `multiplicationFactor`; connections are declared
   only from the output side (`outputExchange.downstreamProcess`), and the
   model's own reference output (`quantitativeReference.referenceToReferenceProcess`)
   is a plain id pointing at one instance — exactly analogous to Process's
   `referenceToReferenceFlow`. `name`/`classification`/`generalComment` and
   the admin block reuse Process's exact shape (not the 5-type shared minimal
   admin). Built as `ModelDataSet` in `src/lib/ilcd.ts` (reusing
   `ProcessDataSet["administrativeInformation"]` via a type alias) with a
   4-tab `ModelForm.tsx`/`ModelDetail.tsx` pair: Model information, Modelling
   and validation, Administrative information, Process instances (a flat
   instance table + a `{fromInstanceId, toInstanceId}` connections table,
   instead of a drag-and-drop graph editor). `DatasetForm.tsx`/`DatasetDetail.tsx`
   simplified into pure type-dispatchers now that all 7 sidebar types have
   dedicated pages — the old generic flat key-value editor is gone entirely.
   Migrated all 3 existing Model mock/seed rows (each a linear process chain)
   into instance+connection lists; all process references resolved cleanly.
   Verified via headless-Chromium (list, detail with the starred reference
   process and connection table, edit form) — `tsc`/`build`/`lint` clean.
   **Phase 3 is now fully done.**

### Phase 4 — Import more real data via the lca-mcp MCP server ✅ done (2026-09-12)

Recap of how the existing 18 lca-mcp processes were imported (prior session,
not detailed in this plan file — per `WORKLOG.md` 2026-09-10 entry, "Add 18
processes from lca-mcp product graphs to seed data"): pulled from the lca-mcp
MCP server's bundled product graphs.

Actually executed, ahead of the original heuristic sketch above: the user
first had all 40 non-MCP-derived rows (the hand-authored 2026-09-08 mock
dataset — models/flows/flow_properties/unit_groups/sources/contacts) deleted
from the live Supabase table, keeping only the 18 real lca-mcp processes, then
had the other 6 types rebuilt **entirely from `list_product_graphs`'s own 10
bundled product graphs** rather than from Brightway/`query_lca_database`:

- **Unit Groups (4)** — Units of mass (kg), volume (L), items (unit),
  transport service (tkm): the literal units the 10 graphs use, not a guessed
  mapping.
- **Flow Properties (4)** — Mass, Volume, Item(s), Transport service, each
  pointing at its unit group.
- **Flows (31)** — every distinct emission/resource/intermediate
  product/background input across all 10 graphs, tagged Elementary or
  Product flow.
- **Sources (10)** — one per product graph, citing `lca-mcp.mathplosion.com`
  and its LCIA method (TRACI v2.1 / EF v3.1).
- **Models (10)** — one Life Cycle Model per product graph (e.g. Jacket's
  5-process P0→P1→P2→P4, P3→P4 chain), using each graph's own `goal` text.
- Patched all 18 process rows' exchange/source `refObjectId`s (previously
  `null`, matched only by free-text `shortDescription`) to point at the real
  new records — this is what actually resolved the dangling refs flagged back
  in Phase 1/2's notes.
- **Contacts stayed empty** — the MCP data has no author/contact metadata,
  matching the "needs a decision" flag above; the decision made was "skip".

`supabase/seed.sql` was **not** kept in sync with this — it still reflects the
old 58-row hand-authored dataset and would restore it if re-run. Flagged to
the user as outstanding, not yet resolved.

### Phase 5 — Export tooling: EcoSpold v2 / TIDAS pipeline ✅ done (2026-09-12)

Off the original roadmap — user-requested mid-session after Phase 4, once real
MCP-sourced data existed to export. Two new committed CLI utilities under
`scripts/` (Python, stdlib + `tidas-tools` for the second one), both driven
live off the Supabase `datasets` table via the anon key:

- **`scripts/export_ecospold.py`** — converts a Model (product graph) into
  schema-valid **EcoSpold v2** XML. Schema verified against the real
  `EcoSpold02.xsd` (fetched from `brightway-lca/pyecospold`) with `lxml`;
  process-to-process links use EcoSpold's `activityLinkId` attribute, verified
  correct against the Jacket 5-process chain.
- **`scripts/export_tidas.py`** — one-shot pipeline: `export_ecospold.py` →
  `tidas-import` → `tidas-validate` → zip, producing a package ready to
  upload to the real TianGong platform (`tiangong-lca/platform`). Iterated
  through three real upload failures against the live platform (its Task
  Center + downloaded import-report JSON were the only feedback loop
  available — no API access), each traced to a specific root cause and fixed
  in the tool itself, not worked around by hand each time:
  1. **"package does not contain any supported TIDAS datasets"** — read
     `tiangong-lca/worker`'s own Rust source
     (`crates/solver-worker/src/package_execution.rs`) and found it requires
     `<table>/<uuid>_<version>.json` filenames (rsplit on the last `_`);
     plain `tidas-tools` output is `<uuid>.json` with no version suffix, so
     every file was silently skipped. Fixed with a post-validation rename
     pass reading each record's own `dataSetVersion`.
  2. **`USER_DATA_CONFLICT`, 0 imported** — the platform rejects an entire
     package if even one record conflicts with existing data; 2 of the 60
     records (a generic unitgroup + flowproperty that `tidas-tools`' EcoSpold2
     adapter always emits identically regardless of input) already existed
     under the user's account. Fixed by excluding
     contacts/sources/unitgroups/flowproperties from the package **by
     default** (flows/processes still reference them by the same id, which
     resolves against what the target already has); added
     `--include-reference-data` to opt back in for a genuinely empty account.
  3. Added `--repair-from-report <report.json>` as a general escape hatch —
     strips whatever a downloaded TianGong import report flags under
     `filtered_open_data`/`user_conflicts` and rewrites the zip, without
     hand-hunting file names again if a conflict shows up in the future.
  Confirmed working end to end: user uploaded a generated package and it
  showed real imported data (Input/Output tab, correct amounts) on
  `lca.tiangong.earth`.

Also delivered ad hoc, not committed to the repo (correctly — they're
generated output, not source): a `.zolca` (openLCA JSON-LD) export for one
graph, built and validated the same way (real schema fetched from
`GreenDelta/olca-schema`) before the user redirected to EcoSpold/TIDAS instead.

### Phase 6 — Align this app's UI with the real TianGong platform ✅ done (2026-09-14)

Distinct from Phases 1-3 (which matched TianGong's *data schema*): this phase
matches TianGong's actual rendered *UI* structure, tab-by-tab, verified
against real `lca.tiangong.earth` screenshots the user provided (not just the
schema research this repo already had). Also pulled TianGong's actual
frontend source (`tiangong-lca/platform`'s `src/locales/en-US/pages_*.ts`) to
check tab names/counts for types not yet screenshotted.

- **Process** ✅ done, screenshot-verified. Added the missing **LCIA Results**
  and **Validation** tabs (honest empty states — no calculation engine exists
  here, matching the original Phase 1 scope decision to skip these rather
  than fake them) so the tab count matches TianGong's 7, not our previous 5.
  Split the Inputs/Outputs table into separate Input/Output tables with
  TianGong's full column set (Flow type, Classification, Version, Reference
  unit, Data derivation type/status, Quantitative reference, Review type),
  resolving each exchange's flow → flow property → unit group chain live.
  Side effect worth knowing: our page now honestly shows empty
  Classification and the real `01.01.000` version, where TianGong's own copy
  of the same data shows a fake ISIC classification and a reset `00.00.001`
  version — both artifacts of the lossy EcoSpold2 round-trip in Phase 5, not
  a bug in either app.
  Verified with a headless-Chromium (Playwright, installed this session) smoke test.
- **Flow** ✅ done, screenshot-verified. Real TianGong has a dedicated 4th
  **"Flow property"** tab (Index/Flow property/Mean value/Reference
  unit/Quantitative reference) separate from "Modelling and validation" —
  ours had it folded into Modelling and validation with different columns.
  Split it out; reference unit resolved live the same way as Process.
- **Flow Property** ✅ done, screenshot-verified. Tab names already matched;
  fixed one label typo ("Flow propert**ies** information" →
  "Flow property information") and added the actual resolved reference-unit
  name (e.g. "Name of unit: L") next to the unit group link, matching
  TianGong's "Quantitative reference" block which ours omitted.
- **Unit Group** ✅ done, screenshot-verified. Real TianGong has a dedicated
  4th **"Units"** tab (Index/Name/Comment/Mean value/Quantitative reference)
  — ours had the units table folded into "Unit group information" with
  different columns ("Unit"/"Conversion factor"). Split it out to match,
  same pattern as Flow's "Flow property" tab.
- **Source, Contact** ✅ verified against real screenshots, no changes
  needed — both already matched TianGong's fields and 2-tab layout.
- **Model** ✅ accepted as-is. Tab names/count match TianGong's real locale
  strings, and the user confirmed on 2026-09-14 that screenshot-level Model
  page synchronization is not required.

---

## Execution order (as requested 2026-09-11, extended 2026-09-12)

1. Phase 2 — Flow, Flow Property, Unit Group, Source, Contact ILCD formats ✅ done
2. Phase 3 — Model external link button, Model Edit, Model's own ILCD format ✅ done
3. Phase 4 — MCP-driven import extended to Models / Flows / Flow Properties /
   Sources / Unit Groups ✅ done
4. Phase 5 — EcoSpold v2 / TIDAS export tooling ✅ done
5. Phase 6 — UI parity with the real TianGong platform ✅ done

## Outstanding items (not yet done, as of 2026-09-14)

- The three ad hoc export artifacts committed under `scripts/`
  (`prepared-tidas.zip`, `ecospold_all_10_graphs.zip`, the two
  `tidas-*-report.json` files) are one-off generated output sitting in the
  repo, not regenerated by CI — fine as a snapshot, but will drift from the
  live dataset over time. `scripts/export_ecospold.py` / `export_tidas.py`
  are the source of truth; the committed zips are not.
