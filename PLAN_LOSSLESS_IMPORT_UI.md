# Lossless Import Storage and Complete Source UI Plan

Prepared for PRISM Dataset Manager · 2026-09-16

Companion engine contract:
[`life-cycle-assessment-mcp/docs/prism_lossless_import_contract.md`](https://github.com/calvinw/life-cycle-assessment-mcp/blob/main/docs/prism_lossless_import_contract.md)

## Status

Planning only. No schema, API, persistence, or UI changes described here have
been implemented yet.

This document is the single roadmap and acceptance source for the cross-repo
work. The engine repository owns only the transport contract and format-specific
source locators; product sequencing, Supabase persistence, UI behavior, and
end-to-end acceptance live here.

Task ownership labels:

- `[DM]` — `prism-dataset-manager`
- `[ENGINE]` — `life-cycle-assessment-mcp`
- `[DB]` — Supabase schema, RLS, RPC, or Storage
- `[SHARED]` — coordinated release or cross-repo acceptance

## Goal

An import must never silently discard source information merely because PRISM's
current normalized schema or UI does not understand it yet.

For every supported input format, a user must be able to:

1. preview every source file and dataset before confirmation;
2. confirm the import without losing the original uploaded bytes;
3. inspect the complete original source after import;
4. distinguish normalized, displayed, unmapped, and derived information;
5. edit supported PRISM fields without deleting unsupported or hidden data;
6. download the exact original upload separately from exporting an edited PRISM
   conversion.

The required formats are:

- openLCA JSON-LD;
- TIDAS JSON;
- EcoSpold2 XML/ZIP;
- SimaPro CSV;
- ILCD/eILCD XML, because it is already accepted by the shared import endpoint
  and must not become the one lossy exception.

## Non-negotiable invariants

### Source fidelity

- The exact uploaded bytes are immutable after confirmation.
- The SHA-256 stored in Supabase must match the uploaded object.
- ZIP entry bytes, filenames, manifest files, unsupported entries, comments,
  language tags, namespaces, ordering, and whitespace remain recoverable from
  the original artifact.
- Source content is never passed through `prepareImportRows`, UUID remapping,
  `refObjectId` rewriting, ILCD normalizers, or edit-form serialization.
- A field may be unsupported, but it may not disappear without an explicit
  mapping status and a route back to its source content.

### Normalized data

- `datasets.payload` remains the normalized, queryable, editable PRISM model.
- Normalization may derive records that do not exist as independent source
  datasets, such as EcoSpold2/SimaPro Models, Flow Properties, and Unit Groups.
- Derived records must identify every source location used to construct them.
- Missing normalized support must not block preservation of the source artifact.

### UI completeness

- Existing seven-type navigation and domain tabs remain the primary UI.
- Every imported dataset gets a `Source data` view even when it has no dedicated
  mapped fields.
- Every package entry, including unsupported entries and manifests, is reachable
  from the import/package view.
- All source languages render dynamically; the UI is not limited to English and
  Chinese.
- Long text preserves line breaks and can expand without truncation.
- Empty normalized fields must not imply that the source file contained no data.
  The UI must label `Not mapped`, `Not present in source`, and `Derived` states
  separately.

### Edit safety

- Saving one supported field must preserve every untouched payload field,
  including unknown nested keys and unknown keys inside repeatable items.
- Forms must patch the original payload rather than replace it with a normalized
  projection.
- Original source artifacts are read-only. Editing PRISM data never rewrites the
  historical source artifact.

## Current failure modes

### Import preview

- Only Model rows can be opened; the other six dataset types show only name and
  a truncated description.
- Warning `details` are hidden.
- The package manifest and unsupported package entries cannot be inspected.
- There is no raw JSON/XML/CSV view or source-file index.

### Persistence

- `commitImport` persists only normalized rows.
- The original upload, package manifest, unsupported entries, and source-to-row
  mapping are not stored.
- The atomic RPC validates normalized references correctly, but has no artifact
  or provenance contract.

### Detail pages

- Detail components intentionally render a subset of the normalized payload.
- `LangRow` renders only `en` and `zh`.
- Several normalized admin fields, exchange comments, and factor comments are
  present in payloads but hidden.
- Process LCIA and Validation tabs show fixed empty states rather than imported
  source content.

### Editing

- Each form initializes state through a `to*DataSet` normalizer.
- The normalizer constructs the known subset and drops unknown keys.
- Saving replaces the entire payload with that projection, so a routine edit can
  destroy future fields even after the importer begins preserving them.

### Format conversion

- openLCA generic import maps only seven root entity types and a subset of their
  fields. Other root types and many Process, Exchange, ProductSystem, parameter,
  uncertainty, cost, DQ, and documentation fields are not normalized.
- TIDAS import flattens references/classifications, omits validation and most
  compliance content, and reduces model connections.
- EcoSpold2 explicitly ignores allocation, classification, impact indicators,
  parameters, pedigree, properties, representativeness, reviews, transfer
  coefficients, uncertainty, and child activities, in addition to other
  unmapped metadata.
- SimaPro currently imports only process CSV files. It ignores methods, product
  stages, parameter sections, waste-scenario sections, and most process metadata
  beyond name, geography, comment, exchanges, and project name.

These are acceptable normalization limitations only after the complete source is
preserved and inspectable.

## Target architecture

```text
Browser File
   ├── preview request ───────────────> LCA Engine
   │                                     ├── normalized datasets
   │                                     ├── package-entry inventory
   │                                     ├── source locators
   │                                     └── mapping coverage/warnings
   │
   ├── local source viewer
   │     └── reads original File/ZIP using engine locators
   │
   └── confirm import
         ├── upload exact bytes ──────> private Supabase Storage
         └── atomic RPC ──────────────> import_batches
                                        import_artifacts
                                        datasets
                                        dataset_source_records

After import:
Detail page ──> normalized datasets.payload
            └─> source record + private artifact download
                  └── complete Source data viewer
```

The engine remains stateless. It does not permanently store uploads or return a
temporary server token. The browser already owns the original `File`; the
engine returns locators and hashes that allow the browser to inspect that file
locally during preview. On confirmation, the browser uploads the same bytes to
private Supabase Storage.

## Supabase data model

### `[DB] import_artifacts`

One immutable record per confirmed uploaded file.

Proposed columns:

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid primary key` | Normally the import batch UUID |
| `created_by` | `uuid not null` | Owner; default `auth.uid()` |
| `source_format` | `text not null` | Canonical interchange format identifier |
| `source_filename` | `text` | Sanitized display filename |
| `media_type` | `text` | ZIP, JSON, XML, CSV, or binary upload type |
| `byte_size` | `bigint not null` | Exact compressed/uploaded byte count |
| `sha256` | `text not null` | Hash of exact uploaded bytes |
| `storage_bucket` | `text not null` | Private artifact bucket |
| `storage_path` | `text not null` | Owner-scoped immutable object path |
| `entry_inventory` | `jsonb not null` | Paths, sizes, hashes, media types, roles |
| `manifest_locator` | `jsonb` | Manifest entry path when applicable |
| `created_at` | `timestamptz` | Audit timestamp |

The object path must be deterministic and owner-scoped, for example:
`<auth.uid()>/<batch-id>/original`.

### `[DB] dataset_source_records`

Links a normalized PRISM dataset to one or more locations in the artifact.

Proposed columns:

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid primary key` | Source-record identity |
| `dataset_id` | `uuid not null` | Imported normalized dataset |
| `artifact_id` | `uuid not null` | Original upload |
| `source_kind` | `text not null` | `direct`, `derived`, or `synthetic` |
| `locators` | `jsonb not null` | Entry path plus JSON/XML/CSV selectors |
| `mapping_report` | `jsonb not null` | Mapped/unmapped/derived path coverage |
| `created_at` | `timestamptz` | Audit timestamp |

`locators` is an array because a derived Flow or Model may depend on several
source elements or files.

### `[DB] import_batches`

Add `artifact_id` and preserve the current summary/report behavior. The batch
remains the idempotency boundary.

### Storage and RLS

- Use a private bucket; never expose permanent public URLs.
- Only the artifact owner may select/download the object and its metadata.
- Anonymous users cannot inspect private source content.
- Dataset visibility does not automatically publish its source artifact. A
  separate reviewed publication workflow would be required later.
- Database rows remain atomic. Storage cannot participate in the PostgreSQL
  transaction, so confirmation uses upload-first semantics:
  1. upload the deterministic artifact object;
  2. verify byte size and hash;
  3. call the idempotent import RPC;
  4. remove the object on known RPC failure;
  5. allow a scheduled cleanup to remove old unreferenced objects after crashes.

## Import API changes

`[ENGINE]` implements the companion contract without changing existing
normalized row fields during the compatibility period.

The preview response gains:

- package byte hash and size;
- complete archive/file entry inventory;
- manifest locator;
- source locator(s) for each normalized row;
- direct/derived/synthetic provenance;
- mapping coverage with explicit unmapped paths;
- structured warnings whose details include source paths/selectors.

The response does not need to duplicate entire source files as base64. Preview
uses the browser's original File. Persistence uses the private Storage object.
This prevents a 25 MB upload from becoming a much larger JSON response while
still retaining exact bytes.

## Format-specific locator requirements

### openLCA JSON-LD

- Direct datasets point to their ZIP entry and root JSON pointer.
- Preserve and inventory every root entity folder, not only the seven normalized
  PRISM types.
- Unsupported entities such as parameters, locations, currencies, DQ systems,
  impact methods/categories, results, EPDs, projects, and social indicators stay
  visible in the package browser.
- Report unmapped properties on supported entities, including custom
  `otherProperties` other than PRISM's own extension.
- A valid unchanged `prismInterchange` payload may still restore normalized data,
  but it does not replace retention of the full openLCA entity.

### TIDAS JSON

- Direct datasets point to their ZIP entry and dataset root JSON pointer.
- Manifest and extra top-level siblings such as `json_tg` remain visible.
- Preserve classification IDs/levels/system names, complete global-reference
  metadata, namespaces, locations, validation, review, all compliance dimensions,
  connection flow/version metadata, and any schema extension in the source view.
- Mapping coverage must distinguish flattened values from fully mapped values.

### EcoSpold2

- Process locators identify the `.spold` entry and Activity UUID.
- Flow locators identify all exchange elements used to reconstruct the Flow.
- reconstructed Unit Groups and Flow Properties use `derived` provenance.
- the reconstructed PRISM Model uses all activity-link locators and is marked
  `synthetic` because EcoSpold2 has no equivalent product-system record.
- Unsupported elements currently named in warnings remain browsable and receive
  exact source selectors.
- Child activities and master-data content remain in the package inventory even
  when no normalized PRISM row is produced.

### SimaPro CSV

- Process locators include source line/row ranges and the process ordinal/name.
- Exchange locators include section name and row range.
- header fields, every process metadata pair, and every section remain visible.
- Methods and Product Stages files remain inspectable even while normalized
  import is rejected or deferred.
- Input/Calculated Parameters, Waste Scenario, Separated Waste, and Remaining
  Waste receive explicit unmapped locators instead of warning-only loss.
- reconstructed Flow, Flow Property, Unit Group, and Model records are marked
  derived/synthetic and point back to the relevant CSV rows.

### ILCD/eILCD

- Direct datasets point to the XML entry and dataset UUID/root element.
- Preserve namespaces, references, mathematical relations, reviews, compliance,
  LCIA/model structures, and all unsupported package entries in the source view.
- Apply the same mapping coverage rules as TIDAS because both represent closely
  related dataset structures.

## UI plan

### `[DM] Shared SourceDataViewer`

Build one reusable component rather than custom raw-data screens per type.

Required modes:

- `Structured` — expandable JSON/XML/CSV structure;
- `Raw` — exact decoded source text with line numbers;
- `Unmapped` — filtered list of unmapped paths and values;
- `Mapping` — source path to normalized PRISM path;
- `Warnings` — code, message, full details, and jump-to-source action.

Required behavior:

- search paths and values;
- expand/collapse all with safe limits for very large files;
- copy value and copy source path;
- preserve whitespace and line breaks;
- expandable/full-width long text;
- syntax highlighting without modifying source text;
- show binary/non-text entries as metadata plus download action;
- virtualize large trees/tables rather than rendering the entire package at once;
- surface hash mismatch as a blocking integrity error.

### `[DM] Import preview`

- Make all seven normalized dataset types clickable.
- Reuse each current Detail component for the `Overview` mode where practical.
- Add `Source data` beside `Overview` for every preview row.
- Add a package-level `Files` view containing the manifest and every entry,
  including unsupported entries.
- Render warning `details` and allow jumping to the relevant source locator.
- Show badges: `Fully mapped`, `Partially mapped`, `Derived`, `Synthetic`, and
  `Unsupported source entry`.
- Never truncate the only available copy of a description; list truncation is
  acceptable only when an expand/detail route is present.

### `[DM] Persisted detail pages`

- Keep the current information/model/admin/I-O tabs.
- Add one shared `Source data` tab to all seven detail pages.
- Add an import-provenance header: format, filename, batch, import time, source
  kind, and original-download action.
- Where source contains a value but the normalized field is empty, display a
  `Not mapped — view source` indicator rather than a misleading blank state.
- Replace hard-coded Process LCIA/Validation empty states when relevant source
  paths exist. Until specialized views are implemented, link those tabs to the
  exact source sections.

### `[DM] Language and long-text behavior`

- Change `Lang` from the closed `en | zh` UI assumption to a validated BCP 47
  language-code string at the rendering boundary.
- Render all languages present in imported values.
- Keep English/Chinese as convenient defaults for newly authored records, not as
  a filter over imported content.
- Add/remove language rows without deleting untouched languages.
- Use `whitespace-pre-wrap`, readable line length, expandable sections, and
  optional full-screen reading for long text.

### `[DM] Edit safety`

Do not solve unknown-field preservation with a shallow `deepMerge`; arrays of
exchanges, units, properties, and process instances require identity-aware
behavior.

Preferred implementation:

1. retain the exact existing normalized payload in form state;
2. expose a typed projection for current controls;
3. record explicit field-path patches from controls;
4. apply patches to the retained payload on submit;
5. key repeatable items by `dataSetInternalID` and preserve unknown sibling
   properties on retained items;
6. make deletion explicit and warn if a removed item contains unmapped fields;
7. regression-test no-op saves and one-field edits against payloads containing
   unknown nested objects and array-item properties.

## Field promotion strategy

The Source Data viewer is the completeness backstop. Specialized domain UI can
then be added incrementally without blocking lossless import.

Suggested placement for later classification:

| Existing area | Field families |
| --- | --- |
| Information | names, synonyms, classifications, tags, descriptions, time, geography |
| Modelling and validation | parameters, formulas, allocation, uncertainty, DQ, representativeness, system model |
| Administrative information | version, timestamps, URI, format, entered-by, ownership, license, copyright, source files |
| Inputs and Outputs | complete exchange fields, comments, units/properties, providers, costs, formulas, uncertainty, derivation |
| Validation | review type/scope/details, reviewer, review report |
| Compliance | all compliance dimensions and compliance-system references |
| LCIA Results | impact indicators, inventory/impact results, result metadata |
| Model instances | functional unit, target amount/unit/property, exact links, groups, parameter sets |
| Additional imported data | mapped later or format-specific fields with no stable domain home |

No field waits for promotion before becoming visible in `Source data`.

## Delivery phases

### Phase 0 — Fixtures and measurable coverage `[SHARED]`

- Add one high-coverage real or sanitized fixture per format.
- Include long multi-paragraph text and at least one language other than `en` or
  `zh`.
- Include unsupported package entries and currently omitted field families.
- Record exact file/entry hashes and expected source locators.
- Produce a machine-readable baseline coverage report from current converters.

Acceptance:

- The team can point to an exact fixture for every claimed preservation case.
- Every scalar source path is classified as mapped, flattened, derived,
  unmapped, metadata-only, or unsupported.

### Phase 1 — Engine provenance contract `[ENGINE]`

- Add package inventory, hashes, locators, provenance, and mapping coverage to
  preview responses.
- Keep existing normalized fields backward compatible.
- Add format-specific locator tests.
- Include complete warning details and source selectors.

Acceptance:

- Every normalized row has at least one locator or an explicit synthetic reason.
- Every unsupported warning can jump to a source entry/selector.
- Package inventory covers every uploaded archive entry.

### Phase 2 — Lossless persistence `[DB] [DM]`

- Add the private Storage bucket, `import_artifacts`,
  `dataset_source_records`, and RLS.
- Extend `import_batches` and the atomic RPC.
- Upload exact bytes before confirmation and verify SHA-256.
- Insert artifact metadata, normalized datasets, and source records in the same
  database transaction.
- Preserve current idempotent retry behavior.
- Add orphan-object cleanup for interrupted confirmations.

Acceptance:

- Downloaded original bytes match the pre-upload SHA-256.
- A failed database import creates no dataset/source metadata; an uploaded but
  unreferenced object is removed immediately or by cleanup.
- User A cannot list or download User B's artifacts.

### Phase 3 — Complete preview and Source Data UI `[DM]`

- Add local ZIP/file reading and the shared viewer.
- Make all datasets clickable.
- Add package Files, mapping, unmapped, and full-warning views.
- Support all languages and readable long text.

Acceptance:

- A signed-out preview can inspect all source content without persisting it.
- Every fixture's manifest, unsupported entry, long text, and foreign-language
  value is discoverable in the UI.

### Phase 4 — Persisted Source Data and edit safety `[DM]`

- Add provenance and Source data tabs to all seven detail pages.
- Add exact-original download.
- Replace payload-replacement forms with patch-based editing.
- Add explicit warnings for deletion of repeatable items containing unmapped
  normalized fields.

Acceptance:

- A no-op edit produces an identical payload.
- Editing one visible field changes only the intended path.
- Original artifact hash never changes.
- Source data remains available after refresh and a new login session.

### Phase 5 — Promote high-value fields `[DM] [ENGINE]`

Promote fields in reviewable batches:

1. common classifications/references/admin metadata;
2. complete Process exchanges;
3. Model functional unit and exact links;
4. validation/review/compliance;
5. parameters/allocation/uncertainty/DQ;
6. LCIA/results;
7. type-specific Flow/Unit/Source/Contact extensions.

Acceptance for each batch:

- promoted fields disappear from the unmapped list;
- normalized round-trip tests exist;
- source and normalized values can be compared in UI;
- edit/export behavior is defined before fields become editable.

### Phase 6 — Export semantics `[SHARED]`

Expose two distinct actions:

- `Download original` — exact immutable uploaded bytes;
- `Export current PRISM data` — conversion from the current edited normalized
  graph.

Never label a converted export as the original file. If a future lossless
format-specific rewriter is added, it must have separate tests and wording.

## Deployment order

1. Land this plan and the engine contract.
2. Land fixtures and contract tests.
3. Deploy additive engine response fields.
4. Deploy additive Supabase tables, bucket, and RLS.
5. Deploy Dataset Manager artifact upload and extended RPC call.
6. Verify a private artifact with two authenticated users.
7. Deploy preview Source Data viewer.
8. Deploy persisted Source Data tabs.
9. Deploy patch-based form saving.
10. Begin field-promotion batches.

The old frontend must continue working while engine fields are additive. The new
frontend must refuse confirmation if artifact upload/hash verification fails;
it must not silently fall back to normalized-only persistence.

## Test matrix

| Case | Expected result |
| --- | --- |
| openLCA ZIP with unsupported root entities | Entries visible; supported rows import; original ZIP preserved |
| TIDAS with manifest and extra sibling keys | Manifest/extras visible; direct dataset locators resolve |
| EcoSpold2 with uncertainty/review/parameter | Fields visible in Source data and listed as unmapped until promoted |
| EcoSpold2 reconstructed Model | Marked synthetic with activity-link provenance |
| SimaPro parameters and ignored sections | Exact CSV rows visible and marked unmapped |
| ILCD/eILCD review and mathematical relations | Source XML visible with exact selectors |
| French-only long comment | Full text and language shown; no forced English replacement |
| Warning with nested details | Full details render and jump to source |
| No-op edit | Payload byte-equivalent after canonical JSON serialization |
| One-field edit with unknown nested keys | Only intended path changes |
| Delete repeatable item with unknown keys | Explicit warning/confirmation; unrelated items unchanged |
| Confirmation submitted twice | One batch, one artifact record, one normalized graph |
| RPC fails after object upload | No partial DB rows; artifact cleaned now or by orphan job |
| User A requests User B artifact | Denied by Storage policy and table RLS |
| Download original | SHA-256 equals local upload |
| Export current data | Reflects edits and is clearly labeled as converted output |

## Definition of done

This initiative is complete when all supported formats satisfy the following:

- the exact original upload can be downloaded and hash-verified;
- every source entry and every source field is inspectable in preview and after
  confirmation, even when it has no normalized representation;
- every normalized dataset explains whether it is direct, derived, or synthetic;
- unmapped information is explicit and searchable, never silent;
- all languages and long text are readable;
- editing supported fields does not delete unknown payload data;
- database and Storage ownership prevent cross-user access;
- original download and converted export are separate, unambiguous actions;
- automated fixtures prove these properties for openLCA, TIDAS, EcoSpold2,
  SimaPro, and ILCD/eILCD.
