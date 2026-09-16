import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listDatasets, type Dataset } from "@/lib/datasets"
import {
  exportOpenLcaPackage,
  OpenLcaExportError,
  type ExportFormat,
} from "@/lib/openlca-export"

type Status = "idle" | "loading" | "error" | "done"

export function ExportOpenLca() {
  const [models, setModels] = useState<Dataset[] | null>(null)
  const [modelId, setModelId] = useState<string>("")
  const [format, setFormat] = useState<ExportFormat>("openlca-json-ld")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)

  useEffect(() => {
    listDatasets("model").then((rows) => {
      setModels(rows)
      if (rows.length > 0) setModelId(rows[0].id)
    })
  }, [])

  async function handleExport() {
    if (!modelId) return
    setStatus("loading")
    setError(null)
    try {
      const { blob, filename } = await exportOpenLcaPackage(format, modelId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setStatus("done")
    } catch (err) {
      if (err instanceof OpenLcaExportError) {
        setError({ code: err.code, message: err.message })
      } else {
        setError({ message: err instanceof Error ? err.message : "Export failed." })
      }
      setStatus("error")
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Export openLCA / ILCD package</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Pick a Model and a format. Every dataset in Open Data is sent to the
            engine, which resolves the dependency closure for that Model and
            returns a downloadable ZIP.
          </p>

          <div className="flex flex-col gap-2">
            <Label>Model</Label>
            <Select
              value={modelId}
              onValueChange={setModelId}
              disabled={!models || models.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={models === null ? "Loading…" : "Select a model"} />
              </SelectTrigger>
              <SelectContent>
                {models?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {models && models.length === 0 && (
              <p className="text-muted-foreground text-xs">
                No models yet — create or import one first.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openlca-json-ld">openLCA JSON-LD</SelectItem>
                <SelectItem value="ilcd-xml">ILCD / eILCD XML</SelectItem>
                <SelectItem value="tidas-json">TIDAS JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleExport} disabled={!modelId || status === "loading"} className="self-start">
            {status === "loading" ? "Exporting…" : "Export"}
          </Button>

          {status === "error" && error && (
            <div className="text-destructive text-sm">
              <p>{error.message}</p>
              {error.code && <p className="text-xs opacity-70">Code: {error.code}</p>}
            </div>
          )}
          {status === "done" && (
            <p className="text-muted-foreground text-sm">Download started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
