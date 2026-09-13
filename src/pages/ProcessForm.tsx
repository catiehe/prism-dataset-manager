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
  DATASET_TYPES_OF_DATA_SET,
  LICENSE_TYPES,
  emptyRef,
  getLangText,
  toProcessDataSet,
  type ComplianceDeclaration,
  type ProcessDataSet,
  type ProcessExchange,
} from "@/lib/ilcd"

function nextInternalId(exchanges: ProcessExchange[]): number {
  return exchanges.reduce((max, e) => Math.max(max, e.dataSetInternalID), 0) + 1
}

export function ProcessForm() {
  const { id } = useParams<{ id?: string }>()
  const session = useSessionStore((s) => s.session)
  const navigate = useNavigate()

  const [ds, setDs] = useState<ProcessDataSet>(() => toProcessDataSet(undefined))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<Dataset | null | undefined>(
    id ? undefined : null,
  )

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => {
      setExisting(d ?? null)
      if (d) setDs(toProcessDataSet(d.payload))
    })
  }, [id])

  if (!session) return <Navigate to="/sign-in" replace />
  if (id && existing === undefined) return null
  if (id && existing === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const info = ds.processInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  function updateInfo(patch: Partial<ProcessDataSet["processInformation"]>) {
    setDs((prev) => ({ ...prev, processInformation: { ...prev.processInformation, ...patch } }))
  }
  function updateModel(patch: Partial<ProcessDataSet["modellingAndValidation"]>) {
    setDs((prev) => ({
      ...prev,
      modellingAndValidation: { ...prev.modellingAndValidation, ...patch },
    }))
  }
  function updateAdmin(patch: Partial<ProcessDataSet["administrativeInformation"]>) {
    setDs((prev) => ({
      ...prev,
      administrativeInformation: { ...prev.administrativeInformation, ...patch },
    }))
  }

  function addExchange() {
    setDs((prev) => ({
      ...prev,
      exchanges: [
        ...prev.exchanges,
        {
          dataSetInternalID: nextInternalId(prev.exchanges),
          referenceToFlowDataSet: emptyRef("flow"),
          exchangeDirection: "Input",
          meanAmount: null,
          resultingAmount: null,
          generalComment: [],
        },
      ],
    }))
  }
  function updateExchange(id: number, patch: Partial<ProcessExchange>) {
    setDs((prev) => ({
      ...prev,
      exchanges: prev.exchanges.map((e) =>
        e.dataSetInternalID === id ? { ...e, ...patch } : e,
      ),
    }))
  }
  function removeExchange(id: number) {
    setDs((prev) => ({
      ...prev,
      exchanges: prev.exchanges.filter((e) => e.dataSetInternalID !== id),
      processInformation: {
        ...prev.processInformation,
        quantitativeReference: {
          referenceToReferenceFlow:
            prev.processInformation.quantitativeReference.referenceToReferenceFlow === id
              ? null
              : prev.processInformation.quantitativeReference.referenceToReferenceFlow,
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
      getLangText(info.dataSetInformation.name.baseName, "en") ||
      getLangText(info.dataSetInformation.name.baseName, "zh") ||
      "Untitled process"
    const description = getLangText(info.dataSetInformation.generalComment, "en") || null

    try {
      const input = { type: "process" as const, name, description, payload: ds as unknown as Record<string, unknown> }
      const dataset = id ? await updateDataset(id, input) : await createDataset(input)
      navigate(`/open-data/process/${dataset.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{id ? "Edit" : "Add"} Process</CardTitle>
      </CardHeader>
      <CardContent>
        {!supabase ? (
          <p className="text-muted-foreground text-sm">
            Supabase isn't configured for this deployment (missing{" "}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so {id ? "editing" : "adding"} processes is unavailable.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Tabs defaultValue="info">
              <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-1 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
                <TabsTrigger value="info">Process information</TabsTrigger>
                <TabsTrigger value="model">Modelling and validation</TabsTrigger>
                <TabsTrigger value="admin">Administrative information</TabsTrigger>
                <TabsTrigger value="io">Inputs and Outputs</TabsTrigger>
                <TabsTrigger value="compliance">Compliance declarations</TabsTrigger>
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
                          classification: e.target.value
                            .split("/")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
                <LangTextField
                  label="General comment on data set"
                  required
                  multiline
                  value={info.dataSetInformation.generalComment}
                  onChange={(v) =>
                    updateInfo({
                      dataSetInformation: { ...info.dataSetInformation, generalComment: v },
                    })
                  }
                />
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="referenceYear">Reference year</Label>
                    <Input
                      id="referenceYear"
                      type="number"
                      value={info.time.referenceYear ?? ""}
                      onChange={(e) =>
                        updateInfo({
                          time: {
                            referenceYear: e.target.value ? Number(e.target.value) : null,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="CN, RER, GLO..."
                      value={info.geography.location}
                      onChange={(e) => updateInfo({ geography: { location: e.target.value } })}
                    />
                  </div>
                </div>
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
                      {DATASET_TYPES_OF_DATA_SET.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <LangTextField
                  label="Data cut-off and completeness principles"
                  required
                  multiline
                  value={model.dataCutOffAndCompletenessPrinciples}
                  onChange={(v) => updateModel({ dataCutOffAndCompletenessPrinciples: v })}
                />
                <DatasetRefField
                  label="Reference to data source"
                  required
                  value={model.referenceToDataSource}
                  onChange={(v) => updateModel({ referenceToDataSource: v })}
                />
                <LangTextField
                  label="Annual supply or production volume"
                  required
                  value={model.annualSupplyOrProductionVolume}
                  onChange={(v) => updateModel({ annualSupplyOrProductionVolume: v })}
                />
              </TabsContent>

              <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
                <DatasetRefField
                  label="Reference to commissioner"
                  required
                  value={admin.referenceToCommissioner}
                  onChange={(v) => updateAdmin({ referenceToCommissioner: v })}
                />
                <LangTextField
                  label="Intended applications"
                  required
                  value={admin.intendedApplications}
                  onChange={(v) => updateAdmin({ intendedApplications: v })}
                />
                <DatasetRefField
                  label="Data generator (person or entity)"
                  value={admin.referenceToPersonOrEntityGeneratingTheDataSet}
                  onChange={(v) =>
                    updateAdmin({ referenceToPersonOrEntityGeneratingTheDataSet: v })
                  }
                />
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="dataSetVersion">Data set version</Label>
                    <Input
                      id="dataSetVersion"
                      required
                      placeholder="01.01.000"
                      value={admin.dataSetVersion}
                      onChange={(e) => updateAdmin({ dataSetVersion: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="permanentDataSetURI">Permanent data set URI</Label>
                    <Input
                      id="permanentDataSetURI"
                      required
                      value={admin.permanentDataSetURI}
                      onChange={(e) => updateAdmin({ permanentDataSetURI: e.target.value })}
                    />
                  </div>
                </div>
                <DatasetRefField
                  label="Reference to ownership of data set"
                  required
                  value={admin.referenceToOwnershipOfDataSet}
                  onChange={(v) => updateAdmin({ referenceToOwnershipOfDataSet: v })}
                />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label>License type</Label>
                    <Select
                      value={admin.licenseType || undefined}
                      onValueChange={(v) => updateAdmin({ licenseType: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {LICENSE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pb-2">
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
                </div>
              </TabsContent>

              <TabsContent value="io" className="flex flex-col gap-2 pt-6">
                <Label>Exchanges</Label>
                {ds.exchanges.map((ex) => {
                  const isReference =
                    info.quantitativeReference.referenceToReferenceFlow === ex.dataSetInternalID
                  return (
                    <div
                      key={ex.dataSetInternalID}
                      className="flex flex-col gap-2 rounded-md border p-2"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={isReference ? "Reference flow" : "Set as reference flow"}
                          onClick={() =>
                            updateInfo({
                              quantitativeReference: {
                                referenceToReferenceFlow: ex.dataSetInternalID,
                              },
                            })
                          }
                        >
                          <Star
                            className={`size-4 ${isReference ? "fill-primary text-primary" : ""}`}
                          />
                        </Button>
                        <Select
                          value={ex.exchangeDirection}
                          onValueChange={(v) =>
                            updateExchange(ex.dataSetInternalID, {
                              exchangeDirection: v as "Input" | "Output",
                            })
                          }
                        >
                          <SelectTrigger className="sm:w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Input">Input</SelectItem>
                            <SelectItem value="Output">Output</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex-1">
                          <DatasetRefField
                            label=""
                            value={ex.referenceToFlowDataSet}
                            onChange={(v) =>
                              updateExchange(ex.dataSetInternalID, { referenceToFlowDataSet: v })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="any"
                          placeholder="mean amount"
                          value={ex.meanAmount ?? ""}
                          onChange={(e) =>
                            updateExchange(ex.dataSetInternalID, {
                              meanAmount: e.target.value ? Number(e.target.value) : null,
                              resultingAmount: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="sm:w-32"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeExchange(ex.dataSetInternalID)}
                          aria-label="Remove exchange"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addExchange}
                  className="self-start"
                >
                  <Plus className="size-4" />
                  Add exchange
                </Button>
              </TabsContent>

              <TabsContent value="compliance" className="flex flex-col gap-2 pt-6">
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
