import { describe, expect, it } from "vitest"
import { prepareImportRows } from "@/lib/import-persistence"
import type { ImportedRow } from "@/lib/openlca-import"

const IDS = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
]

function row(patch: Partial<ImportedRow>): ImportedRow {
  return {
    temporary_id: "import:flow:source-flow",
    source_id: "source-flow",
    id: "20000000-0000-4000-8000-000000000001",
    type: "flow",
    name: "Flow",
    description: "",
    payload: {},
    ...patch,
  }
}

describe("prepareImportRows", () => {
  it("allocates new IDs and rewrites source, normalized, and temporary aliases", () => {
    let next = 0
    const rows = prepareImportRows(
      [
        row({}),
        row({
          temporary_id: "import:process:source-process",
          source_id: "source-process",
          id: "20000000-0000-4000-8000-000000000002",
          type: "process",
          name: "Process",
          payload: {
            refs: [
              { refObjectId: "source-flow" },
              { refObjectId: "20000000-0000-4000-8000-000000000001" },
              { nested: { refObjectId: "import:flow:source-flow" } },
            ],
          },
        }),
      ],
      () => IDS[next++],
    )

    expect(rows.map(({ id }) => id)).toEqual(IDS.slice(0, 2))
    expect(rows[1].payload).toEqual({
      refs: [
        { refObjectId: IDS[0] },
        { refObjectId: IDS[0] },
        { nested: { refObjectId: IDS[0] } },
      ],
    })
  })

  it("leaves external references for the database to validate", () => {
    const externalId = "30000000-0000-4000-8000-000000000001"
    const [prepared] = prepareImportRows(
      [row({ payload: { owner: { refObjectId: externalId } } })],
      () => IDS[0],
    )

    expect(prepared.payload).toEqual({ owner: { refObjectId: externalId } })
  })

  it("rejects duplicate source identifiers", () => {
    expect(() =>
      prepareImportRows(
        [row({}), row({ temporary_id: "different", id: IDS[2] })],
        () => IDS[0],
      ),
    ).toThrow("duplicate source ID")
  })
})
