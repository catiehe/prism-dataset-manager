# Multi-user Import and Dataset Ownership Plan

Prepared for PRISM LCA (`tiangong-simple`) · 2026-09-16

## Implementation status — 2026-09-16

- Phase 0: engine source contract confirmed (`refObjectId` uses the engine
  row's `source_id`; rows also carry `temporary_id` and normalized `id`). A
  real uploaded-package fixture is still desirable before production rollout.
- Phase 1: implemented in the migration, seed generator, dataset types, RLS,
  and ownership-aware list actions. Not applied to the live project yet.
- Phase 2: implemented ID remapping, unit tests, the idempotent atomic RPC,
  Confirm Import UI, completion links, and rollback/reference validation. Not
  applied to the live project yet.
- Phase 3: partially implemented with Open Data/My Data labels; import history
  and filters remain deferred.
- Local verification: PostgreSQL 15 executed the seed and migration; two-user,
  anonymous-read, public-write-denial, rollback, and idempotent-retry checks
  passed. TypeScript build, lint, and frontend unit tests also pass.

## Goal

Turn the existing openLCA preview into a safe, persistent import flow while
making dataset ownership correct for multiple Supabase users.

The intended user flow is:

```text
Upload openLCA ZIP
  -> engine converts it into PRISM datasets
  -> browser shows a read-only preview
  -> user signs in and confirms
  -> one atomic Supabase operation writes the complete dataset graph
  -> imported records appear under Models, Processes, Flows, and other lists
```

Preview remains stateless and may be used while signed out. Persistence always
uses the signed-in user's Supabase session and Row Level Security (RLS).

## Current state and problem

The conversion and preview path is already working:

- `src/lib/openlca-import.ts` sends the ZIP to the LCA engine.
- `src/pages/ImportOpenLca.tsx` keeps the converted datasets in React state.
- Preview records use `temporary_id`; nothing writes them to Supabase.
- The existing `datasets.created_by` column is nullable, has no default, and is
  not used by any RLS policy.
- Current RLS permits any authenticated user to insert, update, or delete any
  dataset. This is not safe for multiple users.

The checked-in 77-row dataset snapshot is shared reference/demo data. It must
remain readable to everyone and must not accidentally become owned by the
first user who edits or imports data.

## Data ownership model

Use two scopes in the first release:

| Scope | `visibility` | `created_by` | Who can read | Who can change |
|---|---|---|---|---|
| Shared catalog | `public` | normally `NULL` | everyone | administrators/service role only |
| User data | `private` | current `auth.uid()` | owner only | owner only |

This intentionally does not add teams or organizations yet. A later
`workspace_id` can extend the model without changing the meaning of
`created_by` or the import API.

### Proposed `datasets` changes

- Keep `created_by uuid references auth.users` and give it
  `default auth.uid()`.
- Add `visibility text not null default 'private'` with an allowed-value check
  for `public` and `private`.
- Require private rows to have an owner.
- Add indexes that support list filtering by `type`, `created_by`, and
  `visibility`.
- Mark all existing snapshot rows as `public`; leave their `created_by` as
  `NULL`.
- New rows created from forms or imports default to `private` and to the
  current user.

Do not trust a `created_by` or `visibility` value supplied by the browser.
Ownership must come from `auth.uid()`, and ordinary users cannot publish rows
into the shared catalog.

### Target RLS behavior

- `SELECT`: allow `visibility = 'public'` or `created_by = auth.uid()`.
- `INSERT`: authenticated users may only create private rows owned by
  themselves.
- `UPDATE`: authenticated users may only update their own private rows, and
  the new row must remain owned by them and private.
- `DELETE`: authenticated users may only delete their own private rows.
- Shared catalog changes continue to use an explicit administrator or service
  workflow, never the browser anon key.

The frontend should not manually filter out other users' rows as a security
mechanism. Correct RLS makes existing list queries naturally return the shared
catalog plus the current user's private rows.

## Import persistence design

### Authentication boundary

- Upload and preview remain available while signed out.
- The Confirm Import button requires an active Supabase session.
- If the session expires after preview, keep the preview in memory, direct the
  user through sign-in, and require confirmation again before writing.
- The LCA engine never receives a Supabase service-role key.

### IDs and internal references

The engine response contains preview-only IDs, while persisted rows need UUIDs.
Before calling Supabase, the frontend must:

1. Verify exactly whether each payload reference uses `temporary_id`,
   `source_id`, or another engine identifier. Lock this response contract down
   with a fixture test before implementing rewriting.
2. Allocate one UUID for every row in the approved batch.
3. Build a complete old-ID-to-new-UUID map before rewriting any record.
4. Recursively rewrite dataset references in payloads using that map.
5. Reject confirmation when an internal reference is unresolved, unless the
   preview explicitly identifies it as an accepted external reference.

The mapping must be generated once per confirmation attempt and passed to the
database as one complete batch. Never insert a Process first and try to repair
its Flow references afterward.

### Atomic database function

Add a Supabase RPC such as `import_datasets(rows jsonb)` that:

1. Rejects signed-out callers.
2. Applies a conservative maximum row count and payload size.
3. Validates UUID uniqueness, allowed dataset types, non-empty names, JSON
   payload objects, and ownership-independent fields.
4. Inserts every row in one transaction with `created_by = auth.uid()` and
   `visibility = 'private'`.
5. Ignores/rejects browser-supplied ownership fields.
6. Returns a stable import report with created IDs and counts by type.
7. Raises on any invalid row so the entire statement rolls back.

Prefer a `security invoker` function so normal RLS remains in force. If a
`security definer` function ever becomes necessary, it must have a fixed
`search_path`, explicit execute grants, and its own `auth.uid()` ownership
checks.

### Import provenance

Create a small `import_batches` table during the persistence phase rather than
trying to reconstruct import history later:

- `id uuid primary key`
- `created_by uuid not null default auth.uid()`
- `source_format text not null`
- `source_filename text`
- `summary jsonb`
- `created_at timestamptz not null default now()`

Add nullable `datasets.import_batch_id` pointing to this table. The same RPC
creates the batch record and all datasets. RLS restricts batch records to their
owner. This provides traceability and leaves room for a future "delete this
import" feature, but undo is not required in the first release.

## Conflict policy

Use a deliberately simple policy for the first persistent release:

- Never overwrite a shared catalog row during import.
- Never overwrite another user's row.
- Incoming source IDs are provenance, not permission to update an existing
  database UUID.
- Default to creating a private copy of the complete imported graph.
- If the package itself contains the same source ID more than once, stop and
  report it before confirmation.

Automatic matching/reuse of public Flows, Flow Properties, and Unit Groups is
deferred until it can compare type, name, reference unit, and other identifying
fields safely. Name-only matching is not sufficient. The preview UI may show
possible matches later, but the user must approve each reuse decision.

## Delivery phases

### Phase 0 — Contract and migration preparation

- Capture a real engine response as a sanitized test fixture.
- Document how payload references relate to `temporary_id` and `source_id`.
- Export or back up the live `datasets` table before changing policies.
- Record current row counts by type and confirm the 77 shared rows have
  `created_by IS NULL`.
- Put schema/policy changes in a new migration file; keep `seed.sql`
  reproducible for clean installations.

Acceptance criteria:

- The reference-rewrite contract is proven by a fixture, not inferred.
- A rollback SQL path and pre-migration row counts are recorded.
- No production data or policy has changed yet.

### Phase 1 — Ownership and RLS foundation

- Add `visibility`, defaults, constraints, and indexes.
- Migrate existing snapshot records to `public`.
- Replace the broad authenticated write policies with owner-scoped policies.
- Update TypeScript `Dataset`/`NewDataset` types as needed without allowing
  callers to choose ownership.
- Verify existing create/edit/delete forms still work for the owner.
- Update `seed.sql` and setup documentation.

Acceptance criteria:

- Anonymous users see only public rows and cannot write.
- User A sees public rows plus A's rows.
- User B sees public rows plus B's rows, but not A's rows.
- A cannot update or delete a public row or B's row, even through direct REST
  calls rather than the UI.
- Existing 77 shared rows remain visible and unchanged.

### Phase 2 — Atomic Confirm Import

- Implement and test the old-ID-to-UUID mapping and payload rewriting helper.
- Add `import_batches`, `datasets.import_batch_id`, their indexes, and RLS.
- Add the atomic import RPC.
- Add a Confirm Import action to the preview page.
- Require sign-in only at confirmation time.
- Disable duplicate clicks while the RPC is running and assign an
  idempotency/import-batch ID for the attempt.
- On success, show counts and links to the imported Models/Processes.
- On failure, retain the preview and show a non-destructive error; no partial
  rows may remain.

Acceptance criteria:

- A successful import appears in the normal lists after refresh.
- Every imported row is private and owned by the confirming user.
- All rewritten references resolve to an imported row or an explicitly
  accepted accessible row.
- A deliberately invalid row causes zero datasets and zero batch records to
  persist.
- Repeated clicking or retrying the same completed attempt cannot create an
  accidental duplicate batch.

### Phase 3 — User-facing data separation and reporting

- Label or filter shared Open Data versus My Data without duplicating the
  underlying storage path.
- Show ownership/visibility where it helps users understand why a record can
  or cannot be edited.
- Add an import history view using `import_batches`.
- Improve the completion report (`created`, future `reused`, `skipped`, and
  errors).
- Add an optional owner-only delete-import operation only after dependency
  checks are designed.

Acceptance criteria:

- Users can distinguish shared data from their own imported data.
- Import history is visible only to its owner.
- UI permissions agree with direct database permissions; hiding a button is
  never the only enforcement.

### Phase 4 — Optional collaboration and deduplication

This phase is intentionally deferred until there is a concrete product need:

- Workspaces/organizations and membership roles.
- Sharing a private dataset with selected users.
- Publishing user data into the shared catalog through review.
- Field-aware duplicate detection and approved reuse of shared references.
- Dataset versioning and audit history.

Do not add these abstractions during Phases 1-2 merely as placeholders.

## Deployment sequence

Use a compatibility-safe release order:

1. Back up and audit the live table.
2. Deploy additive columns/defaults and mark existing rows public.
3. Verify the current frontend still reads and writes correctly.
4. Deploy owner-scoped RLS and immediately run two-user REST/RLS tests.
5. Deploy the frontend types and ownership-aware UI.
6. Deploy `import_batches` and the RPC.
7. Deploy Confirm Import.
8. Run a small real import, verify references and ownership, then test a
   forced rollback.
9. Regenerate the checked-in seed snapshot/documentation after the production
   schema is confirmed.

Do not temporarily weaken RLS during frontend rollout. Database defaults must
keep the existing form code compatible until the new frontend is live.

## Test matrix

At minimum, automate these cases:

| Case | Expected result |
|---|---|
| Signed-out preview | Works; no database write |
| Signed-out confirmation | Redirect/prompt for sign-in; no write |
| User imports valid package | One private atomic batch |
| User imports invalid package | Full rollback |
| User A reads User B dataset | Not returned/not accessible |
| User A mutates User B dataset by REST | Rejected by RLS |
| User mutates shared dataset by REST | Rejected by RLS |
| User reads shared catalog | Allowed |
| Payload contains unresolved internal reference | Confirmation blocked |
| Confirmation is submitted twice | One completed batch |
| Session expires after preview | Re-authentication required before write |

Run TypeScript, lint, production build, database migration tests, and a
browser-level import test. UI tests alone are insufficient for RLS; test the
Supabase API using separate authenticated sessions.

## Non-goals for the first release

- Team/workspace permissions.
- User-controlled publication into Open Data.
- Automatic name-only deduplication.
- Partial import success.
- Editing or persisting data inside the LCA conversion engine.
- Storing the uploaded ZIP permanently.

## Definition of done

The work is complete when a signed-in user can review an openLCA package,
confirm it once, and see a fully connected private dataset graph in the normal
PRISM pages; another user cannot read or mutate it; shared catalog data remains
publicly readable but protected from ordinary writes; and any failed import
leaves the database unchanged.
