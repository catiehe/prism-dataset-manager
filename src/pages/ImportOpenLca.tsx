import { useRef, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DATASET_TYPES,
  type Dataset,
  type DatasetType,
  getDatasetTypeInfo,
} from "@/lib/datasets"
import {
  importOpenLcaPackage,
  OpenLcaImportError,
  type ImportedRow,
  type ImportResult,
} from "@/lib/openlca-import"
import { ModelDetail } from "@/pages/ModelDetail"

type Status = "idle" | "loading" | "error" | "done"

function toPreviewDataset(row: ImportedRow): Dataset {
  return {
    id: row.temporary_id,
    type: row.type,
    name: row.name,
    description: row.description || null,
    payload: row.payload,
    created_at: new Date().toISOString(),
  }
}

function groupByType(rows: ImportedRow[]): Partial<Record<DatasetType, ImportedRow[]>> {
  const groups: Partial<Record<DatasetType, ImportedRow[]>> = {}
  for (const row of rows) {
    ;(groups[row.type] ??= []).push(row)
  }
  return groups
}

export function ImportOpenLca() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [selected, setSelected] = useState<ImportedRow | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus("loading")
    setError(null)
    setSelected(null)
    try {
      const imported = await importOpenLcaPackage(file)
      setResult(imported)
      setStatus("done")
    } catch (err) {
      if (err instanceof OpenLcaImportError) {
        setError({ code: err.code, message: err.message })
      } else {
        setError({ message: err instanceof Error ? err.message : "Import failed." })
      }
      setResult(null)
      setStatus("error")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const groups = result ? groupByType(result.datasets) : {}

  if (selected) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Button variant="outline" size="sm" className="self-start" onClick={() => setSelected(null)}>
          ← Back to import preview
        </Button>
        <ModelDetail dataset={toPreviewDataset(selected)} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Import openLCA package</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Upload an openLCA JSON-LD ZIP export. It's converted in your browser session
            only — nothing is written to Supabase unless a future step adds that.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            disabled={status === "loading"}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground file:hover:bg-primary/80"
          />
          {status === "loading" && (
            <p className="text-muted-foreground text-sm">Uploading and converting…</p>
          )}
          {status === "error" && error && (
            <div className="text-destructive text-sm">
              <p>{error.message}</p>
              {error.code && <p className="text-xs opacity-70">Code: {error.code}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DATASET_TYPES.map(({ type, label }) => (
                    <TableRow key={type}>
                      <TableCell>{label}</TableCell>
                      <TableCell>{result.summary[type] ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              {result.warnings.length === 0 ? (
                <p className="text-muted-foreground text-sm">No warnings.</p>
              ) : (
                <ul className="list-disc pl-5 text-sm">
                  {result.warnings.map((w, i) => (
                    <li key={i}>
                      {w.message}
                      <span className="text-muted-foreground text-xs"> ({w.code})</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Errors</CardTitle>
            </CardHeader>
            <CardContent>
              {result.errors.length === 0 ? (
                <p className="text-muted-foreground text-sm">No errors.</p>
              ) : (
                <ul className="text-destructive list-disc pl-5 text-sm">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      {e.message}
                      <span className="text-xs opacity-70"> ({e.code})</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {DATASET_TYPES.map(({ type }) => {
            const rows = groups[type]
            if (!rows || rows.length === 0) return null
            const info = getDatasetTypeInfo(type)!
            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle>{info.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.temporary_id}>
                          <TableCell className="whitespace-nowrap">
                            {type === "model" ? (
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => setSelected(row)}
                              >
                                {row.name}
                              </button>
                            ) : (
                              row.name
                            )}
                          </TableCell>
                          <TableCell
                            className="max-w-0 w-full truncate text-muted-foreground"
                            title={row.description}
                          >
                            {row.description}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
