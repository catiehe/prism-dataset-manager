# LCA Engine Import/Export Service Plan

Prepared for [`calvinw/life-cycle-assessment-mcp`](https://github.com/calvinw/life-cycle-assessment-mcp) and the PRISM LCA data manager.

## Goal

Add file conversion APIs to the LCA engine so the static PRISM GitHub Pages app can import standard LCA files and export complete packages without implementing format conversion in the browser.

The engine owns parsing, conversion, reference reconstruction, and validation. PRISM owns file selection, preview, user confirmation, Supabase persistence, and browser downloads.

Initial supported operations:

1. Import a standard LCA file and return normalized PRISM datasets for review.
2. Export a PRISM dataset bundle as a validated TIDAS ZIP, including lifecycle models.
3. Export a PRISM dataset bundle as EcoSpold when requested.

Custom PRISM JSON file import is not part of this plan. It is an internal format with little value to outside users.

## Current systems

### PRISM data manager

- React, Vite, and TypeScript
- Static deployment on GitHub Pages
- Production origin: `https://catiehe.github.io`
- Supabase authentication and database access happen directly in the browser
- One `datasets` table stores seven dataset types:
  - `model`
  - `process`
  - `flow`
  - `flow_property`
  - `unit_group`
  - `source`
  - `contact`
- Dataset documents use an ILCD-like JSON structure in the `payload` column

### LCA engine

- Repository: `calvinw/life-cycle-assessment-mcp`
- Production service: `https://lca-mcp.mathplosion.com`
- Transport-independent logic under `lca_core`
- MCP and REST adapters in `lca_server.py`
- REST calculations are currently stateless
- REST endpoints currently accept JSON and require no authentication
- Current browser CORS origins include `https://calvinw.github.io` and local development, but not the PRISM production origin

## System boundary

```text
PRISM GitHub Pages
  - file picker
  - import preview
  - conflict-resolution UI
  - Supabase writes using the signed-in user's session
  - export selection
  - browser download

LCA engine
  - format detection
  - parsing
  - conversion
  - reference and graph reconstruction
  - TIDAS lifecycle-model generation
  - schema validation
  - temporary file management
  - ZIP generation

Supabase
  - user authentication
  - permanent PRISM dataset storage
```

The engine should not permanently store imported files or converted packages in the first release. Each request uses an isolated temporary directory that is removed after the response is complete.

## Import workflow

```text
User selects a file
  → browser uploads it to the engine
  → engine detects and parses the format
  → engine converts it to normalized PRISM dataset objects
  → engine validates references and returns a preview
  → PRISM displays records, warnings, conflicts, and uncertain matches
  → user confirms
  → PRISM writes approved records to Supabase through the user's session
```

Separating preview from persistence is required. Conversion can involve uncertain name matches, generated identifiers, duplicate records, and unresolved references. No imported records should reach Supabase before the user reviews these decisions.

### Initial import formats

Implement formats in this order:

1. TIDAS ZIP
2. EcoSpold 2
3. ILCD/eILCD ZIP
4. openLCA JSON-LD or `.zolca`, if supported by the selected conversion library

Use `tidas-tools` where it already provides an official parser or converter. Add an engine-owned normalization layer that translates its output into PRISM's seven dataset types.

### Import preview endpoint

```http
POST /api/interchange/import/preview
Authorization: Bearer <Supabase access token>
Content-Type: multipart/form-data

file=<uploaded file>
```

Suggested response:

```json
{
  "format": "ecospold2",
  "valid": true,
  "summary": {
    "model": 1,
    "process": 5,
    "flow": 12,
    "flow_property": 2,
    "unit_group": 2,
    "source": 0,
    "contact": 0
  },
  "datasets": [
    {
      "temporary_id": "import:process:1",
      "source_id": "source-format-identifier",
      "type": "process",
      "name": "Jacket assembly",
      "description": "",
      "payload": {},
      "decision": "create"
    }
  ],
  "matches": [
    {
      "temporary_id": "import:flow:2",
      "candidate_dataset_id": "existing-supabase-uuid",
      "confidence": 0.91,
      "reason": "normalized name and unit match"
    }
  ],
  "warnings": [],
  "errors": []
}
```

The engine does not need direct Supabase database access to produce the initial conversion. For duplicate matching, PRISM can include a compact catalog of existing dataset IDs, names, types, and units as a second multipart field. This keeps database authorization in the existing browser/Supabase boundary.

### Import confirmation

For the first release, PRISM writes approved normalized rows directly to Supabase using the authenticated user's existing session and Row Level Security.

Use a Supabase RPC/database function for an atomic batch import if partial writes would leave broken references. The function should:

1. Validate every requested dataset type.
2. Insert or update the full reviewed batch in one transaction.
3. Return inserted IDs and failures.
4. Roll back the entire batch on a reference or constraint failure.

The engine should never receive the Supabase service-role key from the browser.

## Export workflow

```text
User selects a Model and output format
  → PRISM loads the Model and all referenced datasets from Supabase
  → PRISM sends the complete dataset bundle to the engine
  → engine validates the bundle
  → engine converts it to TIDAS or EcoSpold
  → engine validates the generated package
  → engine returns the file response
  → browser downloads the file
```

The request must contain the full referenced dataset closure, not only the Model row. For a TIDAS export this normally includes:

- Selected Model
- Referenced Processes
- Referenced Flows
- Referenced Flow Properties
- Referenced Unit Groups
- Referenced Sources and Contacts when available

### TIDAS export endpoint

```http
POST /api/interchange/export/tidas
Authorization: Bearer <Supabase access token>
Content-Type: application/json
```

Suggested request:

```json
{
  "models": [],
  "processes": [],
  "flows": [],
  "flow_properties": [],
  "unit_groups": [],
  "sources": [],
  "contacts": [],
  "options": {
    "include_reference_data": true
  }
}
```

Successful response:

```http
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename="prism-export-tidas.zip"
X-Conversion-Warnings: 0
```

The package must contain correctly named records:

```text
lifecyclemodels/<uuid>_<version>.json
processes/<uuid>_<version>.json
flows/<uuid>_<version>.json
flowproperties/<uuid>_<version>.json
unitgroups/<uuid>_<version>.json
sources/<uuid>_<version>.json
contacts/<uuid>_<version>.json
```

TIDAS lifecycle models must be generated directly from PRISM Model records. Do not depend on the EcoSpold importer to recreate them: the `tidas-tools` EcoSpold 2 adapter converts activities into Processes and Flows but does not emit lifecycle models.

Each lifecycle model must preserve:

- Model UUID and version
- Name, description, and administrative metadata
- Reference process instance
- Every process instance and multiplication factor
- Process-to-process connections
- Flow UUID used by each connection
- References to the converted Process versions

Run the official `tidas-tools` validator before returning the package. A validation error produces a structured error response instead of a ZIP.

### EcoSpold export endpoint

```http
POST /api/interchange/export/ecospold2
Authorization: Bearer <Supabase access token>
Content-Type: application/json
```

Use the same PRISM dataset-bundle request. Return an XML file for one Model or a ZIP for multiple Models.

## Engine implementation structure

Place transport-independent conversion code under `lca_core`:

```text
lca_core/interchange/
├── __init__.py
├── detect.py
├── errors.py
├── models.py
├── normalize.py
├── import_tidas.py
├── import_ecospold2.py
├── import_ilcd.py
├── import_openlca.py
├── export_tidas.py
├── export_ecospold2.py
├── references.py
└── validation.py
```

Responsibilities:

- `models.py`: typed request, normalized dataset, preview, match, warning, and error models
- `detect.py`: safe format detection based on content and archive structure
- `normalize.py`: conversion to the seven PRISM dataset types
- `references.py`: stable ID mapping, dataset closure checks, and graph reconstruction
- Import modules: source-format parsing and normalization
- Export modules: PRISM-to-target-format conversion
- `validation.py`: source validation, normalized-reference validation, and target validation
- `errors.py`: stable error codes safe for frontend display

Add thin HTTP routes to `lca_server.py`. Those routes should only:

1. Authenticate the request.
2. Enforce request limits.
3. Parse HTTP input.
4. Create and clean up a temporary directory.
5. Call `lca_core.interchange`.
6. Serialize JSON or stream the resulting file.

Do not put conversion rules directly in `lca_server.py`.

## Browser integration

PRISM can upload a file with:

```ts
const form = new FormData()
form.append("file", file)

const response = await fetch(
  `${engineUrl}/api/interchange/import/preview`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: form,
  },
)

const preview = await response.json()
```

PRISM can download an export with:

```ts
const response = await fetch(
  `${engineUrl}/api/interchange/export/tidas`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(datasetBundle),
  },
)

if (!response.ok) {
  throw new Error(await response.text())
}

const blob = await response.blob()
const url = URL.createObjectURL(blob)
const link = document.createElement("a")
link.href = url
link.download = filenameFromContentDisposition(response.headers) ?? "prism-export.zip"
link.click()
URL.revokeObjectURL(url)
```

The engine must expose `Content-Disposition` through CORS so browser JavaScript can read the filename.

## Authentication and security

The existing engine REST API requires no authentication. File conversion endpoints must not be deployed as unrestricted public compute.

Required controls:

1. Accept `Authorization: Bearer <Supabase JWT>`.
2. Verify the JWT signature, issuer, audience, expiration, and authenticated role.
3. Add `https://catiehe.github.io` to the exact CORS allowlist.
4. Keep local development origins explicitly listed.
5. Allow the `Authorization` and `Content-Type` request headers.
6. Expose `Content-Disposition` and any conversion-report headers.
7. Set compressed and uncompressed upload limits.
8. Limit archive entry count and path depth.
9. Reject absolute paths, `..` traversal, symlinks, and archive bombs.
10. Apply request timeouts and per-user rate limits.
11. Never log tokens, file contents, Supabase secrets, or personally identifying metadata.
12. Remove temporary directories in a `finally` block after success or failure.

Suggested initial limits:

- 25 MB compressed upload
- 250 MB uncompressed archive content
- 5,000 archive entries
- 120-second conversion timeout
- One or two active conversion jobs per user

These values should be configurable through environment variables.

## File storage

### First release

Use request-scoped temporary storage only:

```text
/tmp/lca-conversion-<random>/input
/tmp/lca-conversion-<random>/working
/tmp/lca-conversion-<random>/result.zip
```

Return results directly and delete the directory after the response closes. Supabase remains the only permanent user-data store.

### Later asynchronous version

If real packages exceed synchronous request limits, use private Supabase Storage buckets:

```text
imports/<user-id>/<job-id>/source
exports/<user-id>/<job-id>/result.zip
```

Possible flow:

1. Browser uploads directly to a private bucket using the user's Supabase session.
2. Browser sends the object key to the engine.
3. Engine downloads the object under verified user authorization.
4. Engine performs the conversion as a background job.
5. Engine uploads the result to the user's private output path.
6. PRISM polls job status.
7. PRISM presents a short-lived signed download URL.
8. A retention job deletes source and output objects after a defined period.

Do not add persistent object storage until package size or conversion time demonstrates that synchronous requests are insufficient.

## Error contract

Every non-file error response should use a stable JSON shape:

```json
{
  "error": {
    "code": "UNRESOLVED_PROCESS_REFERENCE",
    "message": "The lifecycle model references a process that is not in the export bundle.",
    "details": {
      "model_id": "uuid",
      "process_id": "uuid"
    }
  }
}
```

Suggested status codes:

- `400`: malformed request or unsupported format
- `401`: missing or invalid Supabase token
- `413`: upload or expanded archive exceeds limits
- `422`: source or generated package fails validation
- `429`: rate limit or per-user concurrency limit
- `500`: unexpected conversion failure
- `504`: conversion timeout

## Delivery phases

### Phase 1: Engine foundation

- Add `lca_core.interchange` package and typed contracts.
- Add Supabase JWT verification for conversion routes.
- Add PRISM production origin to CORS.
- Add temporary-directory lifecycle and upload safety limits.
- Add error response contract.

### Phase 2: Complete TIDAS export

- Move the proven PRISM-to-TIDAS logic into the engine.
- Generate lifecycle models directly from PRISM Model graphs.
- Verify Process and Flow UUID mappings.
- Validate with official `tidas-tools` schemas.
- Add `POST /api/interchange/export/tidas`.
- Return a streamed ZIP response.

This phase should ship first because a working conversion prototype already exists and the expected output is known.

### Phase 3: TIDAS import preview

- Safely unpack a TIDAS ZIP.
- Validate it with `tidas-tools`.
- Normalize all supported categories to PRISM datasets.
- Preserve lifecycle models and their process graph.
- Return preview JSON without writing to Supabase.

### Phase 4: EcoSpold 2 import preview

- Parse and validate EcoSpold 2 input.
- Normalize Processes, Flows, and reference data.
- Report clearly when the source contains no lifecycle-model layer.
- Reconstruct a Model only when source links provide enough evidence.
- Mark heuristic reconstruction decisions for user review.

### Phase 5: PRISM import UI and persistence

- Add file picker and upload progress.
- Add preview counts, warnings, and errors.
- Add match/create/skip decisions.
- Add atomic Supabase batch-import RPC.
- Show a final import report with created and reused dataset IDs.

### Phase 6: Additional formats and asynchronous jobs

- Add ILCD/eILCD import.
- Evaluate openLCA JSON-LD and `.zolca` support.
- Measure realistic package sizes and processing times.
- Add object storage and job status only if measurements require them.

## Required tests

### Core conversion tests

- TIDAS export includes lifecycle models, processes, flows, and required reference data.
- Every lifecycle-model Process reference resolves to a packaged Process or an explicitly allowed external reference.
- Every connection uses a valid Flow UUID and downstream process-instance ID.
- Quantitative reference points to an existing process instance.
- UUID and version generation is deterministic.
- Repeating the same export produces semantically identical content.
- Official `tidas-tools` validation reports no errors.

### Import tests

- Valid package produces the expected normalized counts.
- Unsupported format returns `400`.
- Broken ZIP and invalid XML return structured errors.
- Path traversal, symlinks, oversized expansion, and excessive file counts are rejected.
- Missing references are reported without writing data.
- EcoSpold input without a model reports that limitation explicitly.

### HTTP tests

- Valid Supabase JWT is accepted.
- Missing, expired, incorrectly issued, and incorrectly scoped JWTs are rejected.
- PRISM production CORS preflight succeeds.
- Unapproved origins receive no allow-origin header.
- File size and timeout limits are enforced.
- `Content-Disposition` is exposed to browser JavaScript.
- Temporary files are deleted after success and failure.

### End-to-end acceptance tests

1. Export a known PRISM Model as TIDAS.
2. Confirm the ZIP contains `lifecyclemodels`, `processes`, and `flows`.
3. Validate the ZIP with the official validator.
4. Upload it to TianGong and confirm the Model graph is visible.
5. Import that TIDAS package through the preview endpoint.
6. Compare the reconstructed graph with the original PRISM Model.
7. Confirm no Supabase records are written until the user approves the preview.

## Completion criteria

The first complete release is finished when:

- A signed-in PRISM user can export a selected Model as a schema-valid TIDAS ZIP.
- The ZIP contains a usable lifecycle model and all necessary referenced datasets.
- A signed-in user can upload a TIDAS or EcoSpold file and review normalized records before import.
- Confirmed imports are written atomically to Supabase.
- Invalid or ambiguous data is reported clearly.
- The engine retains no source or output files after synchronous requests finish.
- Authentication, CORS, archive safety, rate limits, and cleanup tests pass.

