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
  emptyRef,
  getLangText,
  toModelDataSet,
  type ComplianceDeclaration,
  type ModelConnection,
  type ModelDataSet,
  type ModelProcessInstance,
} from "@/lib/ilcd"

function nextInternalId(instances: ModelProcessInstance[]): number {
  return instances.reduce((max, i) => Math.max(max, i.dataSetInternalID), 0) + 1
}

export function ModelForm() {
  const { id } = useParams<{ id?: string }>()
  const session = useSessionStore((s) => s.session)
  const navigate = useNavigate()

  const [ds, setDs] = useState<ModelDataSet>(() => toModelDataSet(undefined))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<Dataset | null | undefined>(
    id ? undefined : null,
  )

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => {
      setExisting(d ?? null)
      if (d) setDs(toModelDataSet(d.payload))
    })
  }, [id])

  if (!session) return <Navigate to="/sign-in" replace />
  if (id && existing === undefined) return null
  if (id && existing === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const info = ds.modelInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  function updateInfo(patch: Partial<ModelDataSet["modelInformation"]>) {
    setDs((prev) => ({ ...prev, modelInformation: { ...prev.modelInformation, ...patch } }))
  }
  function updateAdmin(patch: Partial<ModelDataSet["administrativeInformation"]>) {
    setDs((prev) => ({
      ...prev,
      administrativeInformation: { ...prev.administrativeInformation, ...patch },
    }))
  }

  function addInstance() {
    setDs((prev) => ({
      ...prev,
      processInstances: [
        ...prev.processInstances,
        {
          dataSetInternalID: nextInternalId(prev.processInstances),
          referenceToProcess: emptyRef("process"),
          multiplicationFactor: 1,
        },
      ],
    }))
  }
  function updateInstance(id: number, patch: Partial<ModelProcessInstance>) {
    setDs((prev) => ({
      ...prev,
      processInstances: prev.processInstances.map((i) =>
        i.dataSetInternalID === id ? { ...i, ...patch } : i,
      ),
    }))
  }
  function removeInstance(id: number) {
    setDs((prev) => ({
      ...prev,
      processInstances: prev.processInstances.filter((i) => i.dataSetInternalID !== id),
      connections: prev.connections.filter(
        (c) => c.fromInstanceId !== id && c.toInstanceId !== id,
      ),
      modelInformation: {
        ...prev.modelInformation,
        quantitativeReference: {
          referenceToReferenceProcess:
            prev.modelInformation.quantitativeReference.referenceToReferenceProcess === id
              ? null
              : prev.modelInformation.quantitativeReference.referenceToReferenceProcess,
        },
      },
    }))
  }

  function addConnection() {
    const first = ds.processInstances[0]?.dataSetInternalID ?? 0
    setDs((prev) => ({
      ...prev,
      connections: [...prev.connections, { fromInstanceId: first, toInstanceId: first }],
    }))
  }
  function updateConnection(i: number, patch: Partial<ModelConnection>) {
    setDs((prev) => ({
      ...prev,
      connections: prev.connections.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }))
  }
  function removeConnection(i: number) {
    setDs((prev) => ({ ...prev, connections: prev.connections.filter((_, idx) => idx !== i) }))
  }

  function addCompliance() {
    setDs((prev) => ({
      ...prev,
      modellingAndValidation: {
        complianceDeclarations: [
          ...prev.modellingAndValidation.complianceDeclarations,
          { referenceToComplianceSystem: "", approvalOfOverallCompliance: "" },
        ],
      },
    }))
  }
  function updateCompliance(i: number, patch: Partial<ComplianceDeclaration>) {
    setDs((prev) => ({
      ...prev,
      modellingAndValidation: {
        complianceDeclarations: prev.modellingAndValidation.complianceDeclarations.map((c, idx) =>
          idx === i ? { ...c, ...patch } : c,
        ),
      },
    }))
  }
  function removeCompliance(i: number) {
    setDs((prev) => ({
      ...prev,
      modellingAndValidation: {
        complianceDeclarations: prev.modellingAndValidation.complianceDeclarations.filter(
          (_, idx) => idx !== i,
        ),
      },
    }))
  }

  function instanceLabel(id: number): string {
    const inst = ds.processInstances.find((i) => i.dataSetInternalID === id)
    return inst ? `#${id} — ${inst.referenceToProcess.shortDescription || "Untitled"}` : `#${id}`
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const name =
      getLangText(info.dataSetInformation.name.baseName, "en") || "Untitled model"
    const description = getLangText(info.dataSetInformation.generalComment, "en") || null

    try {
      const input = { type: "model" as const, name, description, payload: ds as unknown as Record<string, unknown> }
      const dataset = id ? await updateDataset(id, input) : await createDataset(input)
      navigate(`/open-data/model/${dataset.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{id ? "Edit" : "Add"} Model</CardTitle>
      </CardHeader>
      <CardContent>
        {!supabase ? (
          <p className="text-muted-foreground text-sm">
            Supabase isn't configured for this deployment (missing{" "}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so {id ? "editing" : "adding"} models is unavailable.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Tabs defaultValue="info">
              <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-1 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
                <TabsTrigger value="info">Model information</TabsTrigger>
                <TabsTrigger value="model">Modelling and validation</TabsTrigger>
                <TabsTrigger value="admin">Administrative information</TabsTrigger>
                <TabsTrigger value="instances">Process instances</TabsTrigger>
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
                    placeholder="Product systems / Textiles (path, separated by /)"
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
                  required
                  multiline
                  value={info.dataSetInformation.generalComment}
                  onChange={(v) =>
                    updateInfo({
                      dataSetInformation: { ...info.dataSetInformation, generalComment: v },
                    })
                  }
                />
              </TabsContent>

              <TabsContent value="model" className="flex flex-col gap-2 pt-6">
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
              </TabsContent>

              <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
                <DatasetRefField
                  label="Reference to commissioner"
                  value={admin.referenceToCommissioner}
                  onChange={(v) => updateAdmin({ referenceToCommissioner: v })}
                />
                <LangTextField
                  label="Intended applications"
                  value={admin.intendedApplications}
                  onChange={(v) => updateAdmin({ intendedApplications: v })}
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
                <DatasetRefField
                  label="Reference to ownership of data set"
                  value={admin.referenceToOwnershipOfDataSet}
                  onChange={(v) => updateAdmin({ referenceToOwnershipOfDataSet: v })}
                />
                <div className="flex items-center gap-2">
                  <input
                    id="copyright"
                    type="checkbox"
                    checked={admin.copyright}
                    onChange={(e) => updateAdmin({ copyright: e.target.checked })}
                    className="size-4"
                  />
                  <Label htmlFor="copyright" className="font-normal">
                    Copyright
                  </Label>
                </div>
              </TabsContent>

              <TabsContent value="instances" className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col gap-2">
                  <Label>Process instances</Label>
                  {ds.processInstances.map((inst) => {
                    const isReference =
                      info.quantitativeReference.referenceToReferenceProcess ===
                      inst.dataSetInternalID
                    return (
                      <div key={inst.dataSetInternalID} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={isReference ? "Reference process" : "Set as reference process"}
                          onClick={() =>
                            updateInfo({
                              quantitativeReference: {
                                referenceToReferenceProcess: inst.dataSetInternalID,
                              },
                            })
                          }
                        >
                          <Star className={`size-4 ${isReference ? "fill-primary text-primary" : ""}`} />
                        </Button>
                        <div className="flex-1">
                          <DatasetRefField
                            label=""
                            value={inst.referenceToProcess}
                            onChange={(v) =>
                              updateInstance(inst.dataSetInternalID, { referenceToProcess: v })
                            }
                          />
                        </div>
                        <Input
                          type="number"
                          step="any"
                          placeholder="factor"
                          value={inst.multiplicationFactor ?? ""}
                          onChange={(e) =>
                            updateInstance(inst.dataSetInternalID, {
                              multiplicationFactor: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="sm:w-28"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeInstance(inst.dataSetInternalID)}
                          aria-label="Remove process instance"
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
                    onClick={addInstance}
                    className="self-start"
                  >
                    <Plus className="size-4" />
                    Add process instance
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Connections</Label>
                  {ds.connections.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select
                        value={String(c.fromInstanceId)}
                        onValueChange={(v) => updateConnection(i, { fromInstanceId: Number(v) })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ds.processInstances.map((inst) => (
                            <SelectItem
                              key={inst.dataSetInternalID}
                              value={String(inst.dataSetInternalID)}
                            >
                              {instanceLabel(inst.dataSetInternalID)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground text-sm">→</span>
                      <Select
                        value={String(c.toInstanceId)}
                        onValueChange={(v) => updateConnection(i, { toInstanceId: Number(v) })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ds.processInstances.map((inst) => (
                            <SelectItem
                              key={inst.dataSetInternalID}
                              value={String(inst.dataSetInternalID)}
                            >
                              {instanceLabel(inst.dataSetInternalID)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeConnection(i)}
                        aria-label="Remove connection"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addConnection}
                    disabled={ds.processInstances.length === 0}
                    className="self-start"
                  >
                    <Plus className="size-4" />
                    Add connection
                  </Button>
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
