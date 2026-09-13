import { useEffect, useState, type FormEvent } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LangTextField } from "@/components/ilcd/lang-text-field"
import { DatasetRefField } from "@/components/ilcd/dataset-ref-field"
import { createDataset, getDataset, updateDataset, type Dataset } from "@/lib/datasets"
import { supabase } from "@/lib/supabase"
import { useSessionStore } from "@/state/session"
import { PUBLICATION_TYPES, getLangText, toSourceDataSet, type SourceDataSet } from "@/lib/ilcd"

export function SourceForm() {
  const { id } = useParams<{ id?: string }>()
  const session = useSessionStore((s) => s.session)
  const navigate = useNavigate()

  const [ds, setDs] = useState<SourceDataSet>(() => toSourceDataSet(undefined))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<Dataset | null | undefined>(
    id ? undefined : null,
  )

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => {
      setExisting(d ?? null)
      if (d) setDs(toSourceDataSet(d.payload))
    })
  }, [id])

  if (!session) return <Navigate to="/sign-in" replace />
  if (id && existing === undefined) return null
  if (id && existing === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const info = ds.sourceInformation.dataSetInformation
  const admin = ds.administrativeInformation

  function updateInfo(patch: Partial<SourceDataSet["sourceInformation"]["dataSetInformation"]>) {
    setDs((prev) => ({
      ...prev,
      sourceInformation: { dataSetInformation: { ...prev.sourceInformation.dataSetInformation, ...patch } },
    }))
  }
  function updateAdmin(patch: Partial<SourceDataSet["administrativeInformation"]>) {
    setDs((prev) => ({
      ...prev,
      administrativeInformation: { ...prev.administrativeInformation, ...patch },
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const name = getLangText(info.shortName, "en") || "Untitled source"
    const description = getLangText(info.sourceDescriptionOrComment, "en") || null

    try {
      const input = { type: "source" as const, name, description, payload: ds as unknown as Record<string, unknown> }
      const dataset = id ? await updateDataset(id, input) : await createDataset(input)
      navigate(`/open-data/source/${dataset.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{id ? "Edit" : "Add"} Source</CardTitle>
      </CardHeader>
      <CardContent>
        {!supabase ? (
          <p className="text-muted-foreground text-sm">
            Supabase isn't configured for this deployment (missing{" "}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so {id ? "editing" : "adding"} sources is unavailable.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Tabs defaultValue="info">
              <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-1 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
                <TabsTrigger value="info">Source information</TabsTrigger>
                <TabsTrigger value="admin">Administrative information</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex flex-col gap-6 pt-6">
                <LangTextField
                  label="Short name"
                  required
                  value={info.shortName}
                  onChange={(v) => updateInfo({ shortName: v })}
                />
                <div className="flex flex-col gap-2">
                  <Label>Classification</Label>
                  <Input
                    placeholder="Background database / LCI database (path, separated by /)"
                    value={info.classification.join(" / ")}
                    onChange={(e) =>
                      updateInfo({
                        classification: e.target.value.split("/").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sourceCitation">Source citation</Label>
                  <Textarea
                    id="sourceCitation"
                    value={info.sourceCitation}
                    onChange={(e) => updateInfo({ sourceCitation: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Publication type</Label>
                  <Select
                    value={info.publicationType || undefined}
                    onValueChange={(v) => updateInfo({ publicationType: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLICATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <LangTextField
                  label="Description or comment"
                  multiline
                  value={info.sourceDescriptionOrComment}
                  onChange={(v) => updateInfo({ sourceDescriptionOrComment: v })}
                />
                <DatasetRefField
                  label="Reference to contact"
                  value={info.referenceToContact}
                  onChange={(v) => updateInfo({ referenceToContact: v })}
                />
              </TabsContent>

              <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
                <DatasetRefField
                  label="Reference to ownership of data set"
                  value={admin.referenceToOwnershipOfDataSet}
                  onChange={(v) => updateAdmin({ referenceToOwnershipOfDataSet: v })}
                />
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="dataSetVersion">Data set version</Label>
                    <Input
                      id="dataSetVersion"
                      required
                      value={admin.dataSetVersion}
                      onChange={(e) => updateAdmin({ dataSetVersion: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="permanentDataSetURI">Permanent data set URI</Label>
                    <Input
                      id="permanentDataSetURI"
                      value={admin.permanentDataSetURI}
                      onChange={(e) => updateAdmin({ permanentDataSetURI: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : id ? "Save changes" : "Save"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
