import type { DatasetType } from "@/lib/datasets"

const ENGINE_URL = import.meta.env.VITE_LCA_ENGINE_URL ?? "https://lca-mcp.mathplosion.com"

export interface ImportedRow {
  temporary_id: string
  source_id: string
  type: DatasetType
  name: string
  description: string
  payload: Record<string, unknown>
}

export type ImportSummary = Partial<Record<DatasetType, number>>

export interface ImportIssue {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ImportResult {
  format: string
  valid: boolean
  summary: ImportSummary
  datasets: ImportedRow[]
  warnings: ImportIssue[]
  errors: ImportIssue[]
}

export class OpenLcaImportError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function importOpenLcaPackage(file: File): Promise<ImportResult> {
  let response: Response
  try {
    response = await fetch(`${ENGINE_URL}/api/interchange/import/openlca`, {
      method: "POST",
      body: file,
    })
  } catch {
    throw new Error(
      "Couldn't reach the LCA engine. Check your connection, or that the engine is running.",
    )
  }

  if (!response.ok) {
    let code = "UNKNOWN"
    let message = `Import failed with status ${response.status}.`
    try {
      const body = await response.json()
      if (body?.error?.message) message = body.error.message
      if (body?.error?.code) code = body.error.code
    } catch {
      // response wasn't JSON; fall back to the generic message above
    }
    throw new OpenLcaImportError(code, message)
  }

  return response.json()
}
