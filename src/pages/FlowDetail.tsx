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
import { toFlowDataSet, toFlowPropertyDataSet, toUnitGroupDataSet } from "@/lib/ilcd"
import { LangRow } from "@/components/ilcd/lang-row"

function referenceUnitFor(
  flowPropertyId: string | null,
  flowPropertiesById: Map<string, Dataset>,
  unitGroupsById: Map<string, Dataset>,
): string {
  const propertyDataset = flowPropertyId ? flowPropertiesById.get(flowPropertyId) : undefined
  if (!propertyDataset) return "-"
  const property = toFlowPropertyDataSet(propertyDataset.payload)
  const unitGroupId =
    property.flowPropertiesInformation.quantitativeReference.referenceToReferenceUnitGroup
      .refObjectId
  const unitGroupDataset = unitGroupId ? unitGroupsById.get(unitGroupId) : undefined
  if (!unitGroupDataset) return "-"
  const unitGroup = toUnitGroupDataSet(unitGroupDataset.payload)
  const refUnitId = unitGroup.unitGroupInformation.quantitativeReference.referenceToReferenceUnit
  const unit = unitGroup.units.find((u) => u.dataSetInternalID === refUnitId)
  return unit ? `${unitGroupDataset.name} (${unit.name})` : "-"
}

export function FlowDetail() {
  const { id } = useParams<{ id: string }>()
  const [dataset, setDataset] = useState<Dataset | null | undefined>(undefined)
  const [flowPropertiesById, setFlowPropertiesById] = useState<Map<string, Dataset>>(new Map())
  const [unitGroupsById, setUnitGroupsById] = useState<Map<string, Dataset>>(new Map())

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => setDataset(d ?? null))
  }, [id])

  useEffect(() => {
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

  const ds = toFlowDataSet(dataset.payload)
  const info = ds.flowInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link to="/open-data/flow" className="text-sm text-muted-foreground hover:underline">
        ← Back to Flows
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info">
            <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-2 p-2 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
              <TabsTrigger value="info">Flow information</TabsTrigger>
              <TabsTrigger value="model">Modelling and validation</TabsTrigger>
              <TabsTrigger value="admin">Administrative information</TabsTrigger>
              <TabsTrigger value="property">Flow property</TabsTrigger>
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
              {info.dataSetInformation.classification.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Classification</p>
                  <p className="text-muted-foreground text-sm">
                    {info.dataSetInformation.classification.join(" / ")}
                  </p>
                </div>
              )}
              <div className="flex gap-8">
                {info.dataSetInformation.casNumber && (
                  <div>
                    <p className="text-sm font-medium">CAS number</p>
                    <p className="text-muted-foreground text-sm">{info.dataSetInformation.casNumber}</p>
                  </div>
                )}
                {info.dataSetInformation.sumFormula && (
                  <div>
                    <p className="text-sm font-medium">Sum formula</p>
                    <p className="text-muted-foreground text-sm">{info.dataSetInformation.sumFormula}</p>
                  </div>
                )}
              </div>
              <LangRow label="General comment" value={info.dataSetInformation.generalComment} />
            </TabsContent>

            <TabsContent value="model" className="flex flex-col gap-6 pt-6">
              {model.typeOfDataSet && (
                <div>
                  <p className="text-sm font-medium">Type of dataset</p>
                  <p className="text-muted-foreground text-sm">{model.typeOfDataSet}</p>
                </div>
              )}
              {model.complianceDeclarations.length > 0 && (
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

            <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
              <div>
                <p className="text-sm font-medium">Data set version</p>
                <p className="text-muted-foreground text-sm">{admin.dataSetVersion}</p>
              </div>
            </TabsContent>

            <TabsContent value="property" className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Index</TableHead>
                    <TableHead>Flow property</TableHead>
                    <TableHead>Mean value (of flow property)</TableHead>
                    <TableHead>Reference unit</TableHead>
                    <TableHead>Quantitative reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ds.flowProperties.map((p) => {
                    const isReference =
                      info.quantitativeReference.referenceToReferenceFlowProperty ===
                      p.dataSetInternalID
                    return (
                      <TableRow key={p.dataSetInternalID}>
                        <TableCell>{p.dataSetInternalID}</TableCell>
                        <TableCell>
                          {p.referenceToFlowPropertyDataSet.refObjectId ? (
                            <Link
                              to={`/open-data/flow_property/${p.referenceToFlowPropertyDataSet.refObjectId}`}
                              className="text-primary hover:underline"
                            >
                              {p.referenceToFlowPropertyDataSet.shortDescription}
                            </Link>
                          ) : (
                            p.referenceToFlowPropertyDataSet.shortDescription || "-"
                          )}
                        </TableCell>
                        <TableCell>{p.meanValue ?? ""}</TableCell>
                        <TableCell>
                          {referenceUnitFor(
                            p.referenceToFlowPropertyDataSet.refObjectId,
                            flowPropertiesById,
                            unitGroupsById,
                          )}
                        </TableCell>
                        <TableCell>
                          {isReference ? (
                            <CircleCheck className="size-4 text-primary" />
                          ) : (
                            <CircleX className="text-muted-foreground size-4" />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {ds.flowProperties.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No flow properties yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
