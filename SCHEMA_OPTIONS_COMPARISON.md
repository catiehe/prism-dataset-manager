# Dataset Storage Schema: Design Space Comparison

A first-principles comparison of the ways to store multiple "kinds" of dataset
records (process, flow, contact, etc.) — independent of any specific proposal
already on the table.

## The real question

You have N "kinds" of records that share some structure (an owner, a
lifecycle status, a version history, files) and differ in their domain
content (a process has exchanges, a contact has an address, etc.). There are
three basic ways to store that, not two:

**A — One table, one row per kind, discriminator column.** A single
`datasets` table with a `kind` column; the columns that differ by kind live
in a JSONB blob.

**B — One table per kind, administrative columns typed, domain content still
in a blob.** A `processes` table, a `contacts` table, etc., each with its own
`id`, `version`, `state`, `owner` columns — but the process-specific fields
(exchanges, etc.) still live in a JSON column inside each table. This is a
hybrid, not full normalization.

**C — One table per kind, every domain field is a real typed column.** A
`processes` table with an actual `exchanges` relation, a `flow_properties`
table with typed unit-conversion columns, etc. This is the fully-normalized
textbook endpoint, and it's what you'd need if you were going to do
arithmetic on the data in SQL.

## Trade-offs, axis by axis

| Axis | A: shared table + kind column | B: per-kind tables, JSONB domain content | C: per-kind tables, fully typed columns |
|---|---|---|---|
| Adding a new kind | Add one enum value | Add a new table + its own policies/indexes/triggers | Same as B, plus design new typed columns |
| "Browse everything I own" query | One `SELECT ... WHERE owner = ?` | `UNION ALL` across every table | Same as B |
| "Filter processes by exchange amount" in SQL | Not possible — must unpack JSONB in the app | Not possible — same limitation, JSONB domain content | Possible — it's a real column, indexable |
| Policies/indexes/triggers to write & maintain | 1 set | N sets (one per kind) | N sets |
| Data integrity on domain fields | None at the DB layer (JSONB) | None at the DB layer (JSONB) | Full — NOT NULL, CHECK, FK on every field |
| Version history query ("all versions of X") | One join to a dedicated `dataset_versions` table | Self-join on `(id, version)` within one table | Same as B |
| Schema evolution when a kind's fields change | No migration — it's just JSON | No migration — still JSON | Migration required for every field change |
| Enables cross-kind joins (e.g. process → flow reference resolution) | Natural — same table, `dataset_id` FK works for any kind | Awkward — the FK target table depends on the *other row's* kind, so you can't declare a normal FK | Same problem as B |
| Mental model for a new engineer | One shape to learn | N shapes that happen to rhyme | N genuinely different shapes |
| Cost of getting the kind list wrong later | Low — enum value swap | High — table rename/restructure | High |

## What actually drives the choice

The deciding factor isn't "which is more correct" — it's **whether you need
to query or validate the domain-specific fields at the database layer.**

- If the domain fields are only ever read/written as a whole document by the
  app (load it, show it, edit it, save it back) — which is the case for a
  dataset *catalog* — option A gives you everything B gives you, with a
  fraction of the schema surface, because B's typing advantage never gets
  used.
- If you need the database to compute over specific domain fields — sum
  exchange amounts, filter flows by a numeric property, enforce "this field
  is required for this kind" as a real constraint — you need C, and B
  doesn't actually get you there either. A system needing C-like precision
  for *calculation* tables is exactly why those narrow tables would exist as
  strict per-type structures — but that's a different, narrower set of
  tables than the general-purpose catalog tables, which can stay
  JSONB-backed even then.

So the honest trade-off isn't "A vs. B" in the abstract — it's "does this
product need column-level typing on domain fields," and the answer for a
pure metadata/version tracker is no, which leaves A and B as the real
contest. B's only genuine advantage over A (real per-kind FK/constraint
enforcement) doesn't materialize unless the domain content actually moves
into typed columns (option C) — otherwise B just relocates the same JSONB
blob into more tables.
