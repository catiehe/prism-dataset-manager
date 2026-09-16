export type InterchangeFormat =
  | "openlca-json-ld"
  | "ilcd-xml"
  | "tidas-json"
  | "ecospold2"
  | "simapro-csv"

/** Single source of truth for format identifiers <-> display labels, so
 * adding a format only means adding one entry here instead of hunting
 * down every place a format list was hand-copied. */
export const INTERCHANGE_FORMAT_LABELS: Record<InterchangeFormat, string> = {
  "openlca-json-ld": "openLCA JSON-LD",
  "ilcd-xml": "ILCD / eILCD XML",
  "tidas-json": "TIDAS JSON",
  ecospold2: "EcoSpold2",
  "simapro-csv": "SimaPro CSV",
}

export const INTERCHANGE_FORMATS = Object.keys(
  INTERCHANGE_FORMAT_LABELS,
) as InterchangeFormat[]

export function formatLabel(format: string): string {
  return INTERCHANGE_FORMAT_LABELS[format as InterchangeFormat] ?? format
}
