import { DATASET_TYPES, listDatasets, type Dataset, type DatasetType } from "@/lib/datasets"

const ENGINE_URL = import.meta.env.VITE_LCA_ENGINE_URL ?? "https://lca.mathplosion.com"

const PLURAL: Record<DatasetType, string> = {
  model: "models",
  process: "processes",
  flow: "flows",
  flow_property: "flow_properties",
  unit_group: "unit_groups",
  source: "sources",
  contact: "contacts",
}

export type ExportFormat = "openlca-json-ld" | "ilcd-xml" | "tidas-json" | "ecospold2" | "simapro-csv"

export interface ExportRow {
  id: string
  type: DatasetType
  name: string
  description?: string
  payload: Record<string, unknown>
}

export class OpenLcaExportError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function toExportRow(d: Dataset): ExportRow {
  return {
    id: d.id,
    type: d.type,
    name: d.name,
    description: d.description ?? undefined,
    payload: d.payload,
  }
}

/** Every dataset currently in Supabase, keyed by plural type name. Sent alongside
 * model_id so the engine can resolve whatever closure that Model needs. */
async function buildFullBundle(): Promise<Record<string, ExportRow[]>> {
  const bundle: Record<string, ExportRow[]> = {}
  for (const { type } of DATASET_TYPES) {
    const rows = await listDatasets(type)
    bundle[PLURAL[type]] = rows.map(toExportRow)
  }
  return bundle
}

export interface ExportedFile {
  blob: Blob
  filename: string
}

export async function exportOpenLcaPackage(
  format: ExportFormat,
  modelId: string,
): Promise<ExportedFile> {
  const datasets = await buildFullBundle()

  let response: Response
  try {
    response = await fetch(`${ENGINE_URL}/api/interchange/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, model_id: modelId, datasets }),
    })
  } catch {
    throw new Error(
      "Couldn't reach the LCA engine. Check your connection, or that the engine is running.",
    )
  }

  if (!response.ok) {
    let code = "UNKNOWN"
    let message = `Export failed with status ${response.status}.`
    try {
      const body = await response.json()
      if (body?.error?.message) message = body.error.message
      if (body?.error?.code) code = body.error.code
    } catch {
      // response wasn't JSON; fall back to the generic message above
    }
    throw new OpenLcaExportError(code, message)
  }

  const blob = await response.blob()
  // Content-Disposition isn't exposed to JS under the engine's current CORS
  // config, so the filename is hardcoded from the format instead of read
  // off the response.
  const FILENAME_BY_FORMAT: Record<ExportFormat, string> = {
    "openlca-json-ld": "prism-export.openlca.zip",
    "ilcd-xml": "prism-export.ilcd.zip",
    "tidas-json": "prism-export.tidas.zip",
    ecospold2: "prism-export.ecospold2.zip",
    "simapro-csv": "prism-export.simapro.csv",
  }
  return { blob, filename: FILENAME_BY_FORMAT[format] }
}
