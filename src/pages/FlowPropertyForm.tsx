import { useEffect, useState, type FormEvent } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LangTextField } from "@/components/ilcd/lang-text-field"
import { DatasetRefField } from "@/components/ilcd/dataset-ref-field"
import { createDataset, getDataset, updateDataset, type Dataset } from "@/lib/datasets"
import { supabase } from "@/lib/supabase"
import { useSessionStore } from "@/state/session"
import {
  getLangText,
  toFlowPropertyDataSet,
  type ComplianceDeclaration,
  type FlowPropertyDataSet,
} from "@/lib/ilcd"

export function FlowPropertyForm() {
  const { id } = useParams<{ id?: string }>()
  const session = useSessionStore((s) => s.session)
  const navigate = useNavigate()

  const [ds, setDs] = useState<FlowPropertyDataSet>(() => toFlowPropertyDataSet(undefined))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<Dataset | null | undefined>(
    id ? undefined : null,
  )

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => {
      setExisting(d ?? null)
      if (d) setDs(toFlowPropertyDataSet(d.payload))
    })
  }, [id])

  if (!session) return <Navigate to="/sign-in" replace />
  if (id && existing === undefined) return null
  if (id && existing === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const info = ds.flowPropertiesInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  function updateInfo(patch: Partial<FlowPropertyDataSet["flowPropertiesInformation"]>) {
    setDs((prev) => ({
      ...prev,
      flowPropertiesInformation: { ...prev.flowPropertiesInformation, ...patch },
    }))
  }
  function updateModel(patch: Partial<FlowPropertyDataSet["modellingAndValidation"]>) {
    setDs((prev) => ({
      ...prev,
      modellingAndValidation: { ...prev.modellingAndValidation, ...patch },
    }))
  }
  function updateAdmin(patch: Partial<FlowPropertyDataSet["administrativeInformation"]>) {
    setDs((prev) => ({
      ...prev,
      administrativeInformation: { ...prev.administrativeInformation, ...patch },
    }))
  }

  function addCompliance() {
    updateModel({
      complianceDeclarations: [
        ...model.complianceDeclarations,
        { referenceToComplianceSystem: "", approvalOfOverallCompliance: "" },
      ],
    })
  }
  function updateCompliance(i: number, patch: Partial<ComplianceDeclaration>) {
    updateModel({
      complianceDeclarations: model.complianceDeclarations.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    })
  }
  function removeCompliance(i: number) {
    updateModel({
      complianceDeclarations: model.complianceDeclarations.filter((_, idx) => idx !== i),
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const name = getLangText(info.dataSetInformation.name, "en") || "Untitled flow property"
    const description = getLangText(info.dataSetInformation.generalComment, "en") || null

    try {
      const input = {
        type: "flow_property" as const,
        name,
        description,
        payload: ds as unknown as Record<string, unknown>,
      }
      const dataset = id ? await updateDataset(id, input) : await createDataset(input)
      navigate(`/open-data/flow_property/${dataset.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{id ? "Edit" : "Add"} Flow Property</CardTitle>
      </CardHeader>
      <CardContent>
        {!supabase ? (
          <p className="text-muted-foreground text-sm">
            Supabase isn't configured for this deployment (missing{" "}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so {id ? "editing" : "adding"} flow properties is unavailable.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Tabs defaultValue="info">
              <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-1 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
                <TabsTrigger value="info">Flow properties information</TabsTrigger>
                <TabsTrigger value="model">Modelling and validation</TabsTrigger>
                <TabsTrigger value="admin">Administrative information</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex flex-col gap-6 pt-6">
                <LangTextField
                  label="Name"
                  required
                  value={info.dataSetInformation.name}
                  onChange={(v) =>
                    updateInfo({ dataSetInformation: { ...info.dataSetInformation, name: v } })
                  }
                />
                <div className="flex flex-col gap-2">
                  <Label>Classification</Label>
                  <Input
                    placeholder="Technical flow properties / Mass (path, separated by /)"
                    value={info.dataSetInformation.classification.join(" / ")}
                    onChange={(e) =>
                      updateInfo({
                        dataSetInformation: {
                          ...info.dataSetInformation,
                          classification: e.target.value.split("/").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
                <LangTextField
                  label="General comment"
                  multiline
                  value={info.dataSetInformation.generalComment}
                  onChange={(v) =>
                    updateInfo({ dataSetInformation: { ...info.dataSetInformation, generalComment: v } })
                  }
                />
                <DatasetRefField
                  label="Reference to reference unit group"
                  required
                  value={info.quantitativeReference.referenceToReferenceUnitGroup}
                  onChange={(v) =>
                    updateInfo({ quantitativeReference: { referenceToReferenceUnitGroup: v } })
                  }
                />
              </TabsContent>

              <TabsContent value="model" className="flex flex-col gap-6 pt-6">
                <DatasetRefField
                  label="Reference to data source"
                  value={model.referenceToDataSource}
                  onChange={(v) => updateModel({ referenceToDataSource: v })}
                />
                <div className="flex flex-col gap-2">
                  <Label>Compliance declarations</Label>
                  {model.complianceDeclarations.map((c, i) => (
                    <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        placeholder="compliance system, e.g. ISO 14044"
                        value={c.referenceToComplianceSystem}
                        onChange={(e) =>
                          updateCompliance(i, { referenceToComplianceSystem: e.target.value })
                        }
                        className="sm:flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="approval, e.g. Fully compliant"
                          value={c.approvalOfOverallCompliance}
                          onChange={(e) =>
                            updateCompliance(i, { approvalOfOverallCompliance: e.target.value })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeCompliance(i)}
                          aria-label="Remove compliance declaration"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCompliance}
                    className="self-start"
                  >
                    <Plus className="size-4" />
                    Add compliance declaration
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
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
