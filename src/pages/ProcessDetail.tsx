import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { CircleCheck, CircleX } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDataset, listDatasets, type Dataset } from "@/lib/datasets"
import {
  toFlowDataSet,
  toFlowPropertyDataSet,
  toProcessDataSet,
  toUnitGroupDataSet,
  type ProcessExchange,
} from "@/lib/ilcd"
import { LangRow } from "@/components/ilcd/lang-row"

interface ResolvedFlow {
  flowType: string
  classification: string
  version: string
  referenceUnit: string
}

function resolveFlowInfo(
  flowDataset: Dataset | undefined,
  flowPropertiesById: Map<string, Dataset>,
  unitGroupsById: Map<string, Dataset>,
): ResolvedFlow | undefined {
  if (!flowDataset) return undefined
  const flow = toFlowDataSet(flowDataset.payload)

  const refPropertyId = flow.flowInformation.quantitativeReference.referenceToReferenceFlowProperty
  const propertyAmount = flow.flowProperties.find((p) => p.dataSetInternalID === refPropertyId)
  const propertyId = propertyAmount?.referenceToFlowPropertyDataSet.refObjectId ?? undefined
  const propertyDataset = propertyId ? flowPropertiesById.get(propertyId) : undefined
  const property = propertyDataset ? toFlowPropertyDataSet(propertyDataset.payload) : undefined

  const unitGroupId = property?.flowPropertiesInformation.quantitativeReference
    .referenceToReferenceUnitGroup.refObjectId ?? undefined
  const unitGroupDataset = unitGroupId ? unitGroupsById.get(unitGroupId) : undefined
  const unitGroup = unitGroupDataset ? toUnitGroupDataSet(unitGroupDataset.payload) : undefined
  const refUnitId = unitGroup?.unitGroupInformation.quantitativeReference.referenceToReferenceUnit
  const unit = unitGroup?.units.find((u) => u.dataSetInternalID === refUnitId)

  return {
    flowType: flow.modellingAndValidation.typeOfDataSet || "-",
    classification: flow.flowInformation.dataSetInformation.classification.join(" / ") || "-",
    version: flowDataset.payload && typeof flowDataset.payload === "object"
      ? (flowDataset.payload as { administrativeInformation?: { dataSetVersion?: string } })
          .administrativeInformation?.dataSetVersion ?? "-"
      : "-",
    referenceUnit:
      unitGroupDataset && unit ? `${unitGroupDataset.name} (${unit.name})` : "-",
  }
}

function ExchangeTable({
  title,
  exchanges,
  referenceInternalId,
  flowsById,
  flowPropertiesById,
  unitGroupsById,
}: {
  title: string
  exchanges: ProcessExchange[]
  referenceInternalId: number | null
  flowsById: Map<string, Dataset>
  flowPropertiesById: Map<string, Dataset>
  unitGroupsById: Map<string, Dataset>
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Index</TableHead>
            <TableHead>Flow</TableHead>
            <TableHead>Flow type</TableHead>
            <TableHead>Classification</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Mean amount</TableHead>
            <TableHead>Resulting amount</TableHead>
            <TableHead>Reference unit</TableHead>
            <TableHead>Data derivation type / status</TableHead>
            <TableHead>Quantitative reference</TableHead>
            <TableHead>Review type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exchanges.map((ex) => {
            const flowDataset = ex.referenceToFlowDataSet.refObjectId
              ? flowsById.get(ex.referenceToFlowDataSet.refObjectId)
              : undefined
            const resolved = resolveFlowInfo(flowDataset, flowPropertiesById, unitGroupsById)
            const isReference = ex.dataSetInternalID === referenceInternalId
            return (
              <TableRow key={ex.dataSetInternalID}>
                <TableCell>{ex.dataSetInternalID}</TableCell>
                <TableCell>
                  {flowDataset ? (
                    <Link
                      to={`/open-data/flow/${flowDataset.id}`}
                      className="text-primary hover:underline"
                    >
                      {ex.referenceToFlowDataSet.shortDescription}
                    </Link>
                  ) : (
                    ex.referenceToFlowDataSet.shortDescription || "-"
                  )}
                </TableCell>
                <TableCell>{resolved?.flowType ?? "-"}</TableCell>
                <TableCell>{resolved?.classification ?? "-"}</TableCell>
                <TableCell>{resolved?.version ?? "-"}</TableCell>
                <TableCell>{ex.meanAmount ?? ""}</TableCell>
                <TableCell>{ex.resultingAmount ?? ""}</TableCell>
                <TableCell>{resolved?.referenceUnit ?? "-"}</TableCell>
                <TableCell>Unknown derivation</TableCell>
                <TableCell>
                  {isReference ? (
                    <CircleCheck className="size-4 text-primary" />
                  ) : (
                    <CircleX className="text-muted-foreground size-4" />
                  )}
                </TableCell>
                <TableCell>Unreviewed</TableCell>
              </TableRow>
            )
          })}
          {exchanges.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-muted-foreground">
                No {title.toLowerCase()} exchanges.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function ProcessDetail() {
  const { id } = useParams<{ id: string }>()
  const [dataset, setDataset] = useState<Dataset | null | undefined>(undefined)
  const [flowsById, setFlowsById] = useState<Map<string, Dataset>>(new Map())
  const [flowPropertiesById, setFlowPropertiesById] = useState<Map<string, Dataset>>(new Map())
  const [unitGroupsById, setUnitGroupsById] = useState<Map<string, Dataset>>(new Map())

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => setDataset(d ?? null))
  }, [id])

  useEffect(() => {
    listDatasets("flow").then((rows) => setFlowsById(new Map(rows.map((r) => [r.id, r]))))
    listDatasets("flow_property").then((rows) =>
      setFlowPropertiesById(new Map(rows.map((r) => [r.id, r]))),
    )
    listDatasets("unit_group").then((rows) =>
      setUnitGroupsById(new Map(rows.map((r) => [r.id, r]))),
    )
  }, [])

  if (dataset === undefined) return null
  if (dataset === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const ds = toProcessDataSet(dataset.payload)
  const info = ds.processInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation
  const referenceInternalId = info.quantitativeReference.referenceToReferenceFlow
  const inputs = ds.exchanges.filter((ex) => ex.exchangeDirection === "Input")
  const outputs = ds.exchanges.filter((ex) => ex.exchangeDirection === "Output")

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link
        to="/open-data/process"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to Processes
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info">
            <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-2 p-2 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
              <TabsTrigger value="info">Process information</TabsTrigger>
              <TabsTrigger value="model">Modelling and validation</TabsTrigger>
              <TabsTrigger value="admin">Administrative information</TabsTrigger>
              <TabsTrigger value="io">Inputs and Outputs</TabsTrigger>
              <TabsTrigger value="lcia">LCIA Results</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="compliance">Compliance declarations</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex flex-col gap-6 pt-6">
              <p className="text-muted-foreground text-xs">ID: {dataset.id}</p>
              <LangRow label="Base name" value={info.dataSetInformation.name.baseName} />
              <LangRow
                label="Treatment, standards, routes"
                value={info.dataSetInformation.name.treatmentStandardsRoutes}
              />
              <LangRow
                label="Mix and location types"
                value={info.dataSetInformation.name.mixAndLocationTypes}
              />
              <div>
                <p className="text-sm font-medium">Classification</p>
                <p className="text-muted-foreground text-sm">
                  {info.dataSetInformation.classification.join(" / ") || "-"}
                </p>
              </div>
              <LangRow
                label="General comment on data set"
                value={info.dataSetInformation.generalComment}
              />
              <div className="flex gap-8">
                <div>
                  <p className="text-sm font-medium">Reference year</p>
                  <p className="text-muted-foreground text-sm">
                    {info.time.referenceYear ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-muted-foreground text-sm">
                    {info.geography.location || "-"}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="model" className="flex flex-col gap-6 pt-6">
              <div>
                <p className="text-sm font-medium">Type of dataset</p>
                <p className="text-muted-foreground text-sm">{model.typeOfDataSet || "-"}</p>
              </div>
              <LangRow
                label="Data cut-off and completeness principles"
                value={model.dataCutOffAndCompletenessPrinciples}
              />
              <div>
                <p className="text-sm font-medium">Reference to data source</p>
                <p className="text-muted-foreground text-sm">
                  {model.referenceToDataSource.shortDescription || "-"}
                </p>
              </div>
              <LangRow
                label="Annual supply or production volume"
                value={model.annualSupplyOrProductionVolume}
              />
            </TabsContent>

            <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
              <div>
                <p className="text-sm font-medium">Reference to commissioner</p>
                <p className="text-muted-foreground text-sm">
                  {admin.referenceToCommissioner.shortDescription || "-"}
                </p>
              </div>
              <LangRow label="Intended applications" value={admin.intendedApplications} />
              <div>
                <p className="text-sm font-medium">Data generator</p>
                <p className="text-muted-foreground text-sm">
                  {admin.referenceToPersonOrEntityGeneratingTheDataSet.shortDescription || "-"}
                </p>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-sm font-medium">Data set version</p>
                  <p className="text-muted-foreground text-sm">{admin.dataSetVersion}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">License type</p>
                  <p className="text-muted-foreground text-sm">{admin.licenseType || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Copyright</p>
                  <p className="text-muted-foreground text-sm">
                    {admin.copyright ? "Yes" : "No"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Reference to ownership of data set</p>
                <p className="text-muted-foreground text-sm">
                  {admin.referenceToOwnershipOfDataSet.shortDescription || "-"}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="io" className="flex flex-col gap-6 pt-6">
              <ExchangeTable
                title="Input"
                exchanges={inputs}
                referenceInternalId={referenceInternalId}
                flowsById={flowsById}
                flowPropertiesById={flowPropertiesById}
                unitGroupsById={unitGroupsById}
              />
              <ExchangeTable
                title="Output"
                exchanges={outputs}
                referenceInternalId={referenceInternalId}
                flowsById={flowsById}
                flowPropertiesById={flowPropertiesById}
                unitGroupsById={unitGroupsById}
              />
            </TabsContent>

            <TabsContent value="lcia" className="flex flex-col gap-6 pt-6">
              <div>
                <p className="text-sm font-medium">LCIA Profile</p>
                <p className="text-muted-foreground text-sm">
                  Bars are normalized by the largest absolute impact value. Exact raw values
                  remain in the table below.
                </p>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-sm font-medium">Impact categories</p>
                  <p className="text-2xl">0</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Non-zero categories</p>
                  <p className="text-2xl">0</p>
                </div>
              </div>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Largest positive category</TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Largest negative category</TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-muted-foreground text-sm">
                No LCIA results available for profile analysis.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Index</TableHead>
                    <TableHead>LCIA</TableHead>
                    <TableHead>Mean amount</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="validation" className="pt-6">
              <p className="text-muted-foreground text-sm">
                No validation records available. This process has not been reviewed.
              </p>
            </TabsContent>

            <TabsContent value="compliance" className="pt-6">
              {model.complianceDeclarations.length === 0 ? (
                <p className="text-muted-foreground text-sm">No compliance declarations.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Compliance system</TableHead>
                      <TableHead>Approval</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.complianceDeclarations.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{c.referenceToComplianceSystem}</TableCell>
                        <TableCell>{c.approvalOfOverallCompliance}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
