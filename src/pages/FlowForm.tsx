import { useEffect, useState, type FormEvent } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { Plus, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  FLOW_TYPES,
  emptyRef,
  getLangText,
  toFlowDataSet,
  type ComplianceDeclaration,
  type FlowDataSet,
  type FlowPropertyAmount,
} from "@/lib/ilcd"

function nextInternalId(props: FlowPropertyAmount[]): number {
  return props.reduce((max, p) => Math.max(max, p.dataSetInternalID), 0) + 1
}

export function FlowForm() {
  const { id } = useParams<{ id?: string }>()
  const session = useSessionStore((s) => s.session)
  const navigate = useNavigate()

  const [ds, setDs] = useState<FlowDataSet>(() => toFlowDataSet(undefined))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<Dataset | null | undefined>(
    id ? undefined : null,
  )

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => {
      setExisting(d ?? null)
      if (d) setDs(toFlowDataSet(d.payload))
    })
  }, [id])

  if (!session) return <Navigate to="/sign-in" replace />
  if (id && existing === undefined) return null
  if (id && existing === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const info = ds.flowInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  function updateInfo(patch: Partial<FlowDataSet["flowInformation"]>) {
    setDs((prev) => ({ ...prev, flowInformation: { ...prev.flowInformation, ...patch } }))
  }
  function updateModel(patch: Partial<FlowDataSet["modellingAndValidation"]>) {
    setDs((prev) => ({
      ...prev,
      modellingAndValidation: { ...prev.modellingAndValidation, ...patch },
    }))
  }
  function updateAdmin(patch: Partial<FlowDataSet["administrativeInformation"]>) {
    setDs((prev) => ({
      ...prev,
      administrativeInformation: { ...prev.administrativeInformation, ...patch },
    }))
  }

  function addFlowProperty() {
    setDs((prev) => ({
      ...prev,
      flowProperties: [
        ...prev.flowProperties,
        {
          dataSetInternalID: nextInternalId(prev.flowProperties),
          referenceToFlowPropertyDataSet: emptyRef("flow_property"),
          meanValue: null,
          generalComment: [],
        },
      ],
    }))
  }
  function updateFlowProperty(id: number, patch: Partial<FlowPropertyAmount>) {
    setDs((prev) => ({
      ...prev,
      flowProperties: prev.flowProperties.map((p) =>
        p.dataSetInternalID === id ? { ...p, ...patch } : p,
      ),
    }))
  }
  function removeFlowProperty(id: number) {
    setDs((prev) => ({
      ...prev,
      flowProperties: prev.flowProperties.filter((p) => p.dataSetInternalID !== id),
      flowInformation: {
        ...prev.flowInformation,
        quantitativeReference: {
          referenceToReferenceFlowProperty:
            prev.flowInformation.quantitativeReference.referenceToReferenceFlowProperty === id
              ? null
              : prev.flowInformation.quantitativeReference.referenceToReferenceFlowProperty,
        },
      },
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

    const name =
      getLangText(info.dataSetInformation.name.baseName, "en") || "Untitled flow"
    const description = getLangText(info.dataSetInformation.generalComment, "en") || null

    try {
      const input = { type: "flow" as const, name, description, payload: ds as unknown as Record<string, unknown> }
      const dataset = id ? await updateDataset(id, input) : await createDataset(input)
      navigate(`/open-data/flow/${dataset.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{id ? "Edit" : "Add"} Flow</CardTitle>
      </CardHeader>
      <CardContent>
        {!supabase ? (
          <p className="text-muted-foreground text-sm">
            Supabase isn't configured for this deployment (missing{" "}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so {id ? "editing" : "adding"} flows is unavailable.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Tabs defaultValue="info">
              <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-2 p-2 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
                <TabsTrigger value="info">Flow information</TabsTrigger>
                <TabsTrigger value="model">Modelling and validation</TabsTrigger>
                <TabsTrigger value="admin">Administrative information</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex flex-col gap-6 pt-6">
                <LangTextField
                  label="Base name"
                  required
                  value={info.dataSetInformation.name.baseName}
                  onChange={(v) =>
                    updateInfo({
                      dataSetInformation: {
                        ...info.dataSetInformation,
                        name: { ...info.dataSetInformation.name, baseName: v },
                      },
                    })
                  }
                />
                <LangTextField
                  label="Treatment, standards, routes"
                  value={info.dataSetInformation.name.treatmentStandardsRoutes}
                  onChange={(v) =>
                    updateInfo({
                      dataSetInformation: {
                        ...info.dataSetInformation,
                        name: { ...info.dataSetInformation.name, treatmentStandardsRoutes: v },
                      },
                    })
                  }
                />
                <LangTextField
                  label="Mix and location types"
                  value={info.dataSetInformation.name.mixAndLocationTypes}
                  onChange={(v) =>
                    updateInfo({
                      dataSetInformation: {
                        ...info.dataSetInformation,
                        name: { ...info.dataSetInformation.name, mixAndLocationTypes: v },
                      },
                    })
                  }
                />
                <div className="flex flex-col gap-2">
                  <Label>Classification</Label>
                  <Input
                    placeholder="Materials / Metals / Steel (path, separated by /)"
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
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="casNumber">CAS number</Label>
                    <Input
                      id="casNumber"
                      placeholder="000124-38-9"
                      value={info.dataSetInformation.casNumber}
                      onChange={(e) =>
                        updateInfo({
                          dataSetInformation: { ...info.dataSetInformation, casNumber: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="sumFormula">Sum formula</Label>
                    <Input
                      id="sumFormula"
                      placeholder="CO2"
                      value={info.dataSetInformation.sumFormula}
                      onChange={(e) =>
                        updateInfo({
                          dataSetInformation: { ...info.dataSetInformation, sumFormula: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
                <LangTextField
                  label="General comment"
                  multiline
                  value={info.dataSetInformation.generalComment}
                  onChange={(v) =>
                    updateInfo({
                      dataSetInformation: { ...info.dataSetInformation, generalComment: v },
                    })
                  }
                />
              </TabsContent>

              <TabsContent value="model" className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col gap-2">
                  <Label>Type of dataset</Label>
                  <Select
                    value={model.typeOfDataSet || undefined}
                    onValueChange={(v) => updateModel({ typeOfDataSet: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Flow properties</Label>
                  {ds.flowProperties.map((p) => {
                    const isReference =
                      info.quantitativeReference.referenceToReferenceFlowProperty ===
                      p.dataSetInternalID
                    return (
                      <div key={p.dataSetInternalID} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={isReference ? "Reference flow property" : "Set as reference flow property"}
                          onClick={() =>
                            updateInfo({
                              quantitativeReference: {
                                referenceToReferenceFlowProperty: p.dataSetInternalID,
                              },
                            })
                          }
                        >
                          <Star className={`size-4 ${isReference ? "fill-primary text-primary" : ""}`} />
                        </Button>
                        <div className="flex-1">
                          <DatasetRefField
                            label=""
                            value={p.referenceToFlowPropertyDataSet}
                            onChange={(v) =>
                              updateFlowProperty(p.dataSetInternalID, { referenceToFlowPropertyDataSet: v })
                            }
                          />
                        </div>
                        <Input
                          type="number"
                          step="any"
                          placeholder="conversion factor"
                          value={p.meanValue ?? ""}
                          onChange={(e) =>
                            updateFlowProperty(p.dataSetInternalID, {
                              meanValue: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="sm:w-40"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeFlowProperty(p.dataSetInternalID)}
                          aria-label="Remove flow property"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFlowProperty}
                    className="self-start"
                  >
                    <Plus className="size-4" />
                    Add flow property
                  </Button>
                </div>

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
