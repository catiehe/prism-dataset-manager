import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
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
import { toFlowPropertyDataSet, toUnitGroupDataSet } from "@/lib/ilcd"
import { LangRow } from "@/components/ilcd/lang-row"

export function FlowPropertyDetail() {
  const { id } = useParams<{ id: string }>()
  const [dataset, setDataset] = useState<Dataset | null | undefined>(undefined)
  const [unitGroupsById, setUnitGroupsById] = useState<Map<string, Dataset>>(new Map())

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => setDataset(d ?? null))
  }, [id])

  useEffect(() => {
    listDatasets("unit_group").then((rows) =>
      setUnitGroupsById(new Map(rows.map((r) => [r.id, r]))),
    )
  }, [])

  if (dataset === undefined) return null
  if (dataset === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const ds = toFlowPropertyDataSet(dataset.payload)
  const info = ds.flowPropertiesInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  const unitGroupId = info.quantitativeReference.referenceToReferenceUnitGroup.refObjectId
  const unitGroupDataset = unitGroupId ? unitGroupsById.get(unitGroupId) : undefined
  const unitGroup = unitGroupDataset ? toUnitGroupDataSet(unitGroupDataset.payload) : undefined
  const refUnitId = unitGroup?.unitGroupInformation.quantitativeReference.referenceToReferenceUnit
  const referenceUnitName = unitGroup?.units.find((u) => u.dataSetInternalID === refUnitId)?.name

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link to="/open-data/flow_property" className="text-sm text-muted-foreground hover:underline">
        ← Back to Flow Properties
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info">
            <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-1 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
              <TabsTrigger value="info">Flow property information</TabsTrigger>
              <TabsTrigger value="model">Modelling and validation</TabsTrigger>
              <TabsTrigger value="admin">Administrative information</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex flex-col gap-6 pt-6">
              <p className="text-muted-foreground text-xs">ID: {dataset.id}</p>
              <LangRow label="Name" value={info.dataSetInformation.name} />
              {info.dataSetInformation.classification.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Classification</p>
                  <p className="text-muted-foreground text-sm">
                    {info.dataSetInformation.classification.join(" / ")}
                  </p>
                </div>
              )}
              <LangRow label="General comment" value={info.dataSetInformation.generalComment} />
              {info.quantitativeReference.referenceToReferenceUnitGroup.shortDescription && (
                <div>
                  <p className="text-sm font-medium">Reference unit</p>
                  <p className="text-muted-foreground text-sm">
                    {unitGroupDataset ? (
                      <Link
                        to={`/open-data/unit_group/${unitGroupDataset.id}`}
                        className="text-primary hover:underline"
                      >
                        {info.quantitativeReference.referenceToReferenceUnitGroup.shortDescription}
                      </Link>
                    ) : (
                      info.quantitativeReference.referenceToReferenceUnitGroup.shortDescription
                    )}
                  </p>
                  {referenceUnitName && (
                    <p className="text-muted-foreground text-sm">
                      Name of unit: {referenceUnitName}
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="model" className="flex flex-col gap-6 pt-6">
              {model.referenceToDataSource.shortDescription && (
                <div>
                  <p className="text-sm font-medium">Reference to data source</p>
                  <p className="text-muted-foreground text-sm">
                    {model.referenceToDataSource.shortDescription}
                  </p>
                </div>
              )}
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

            <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
              <div>
                <p className="text-sm font-medium">Data set version</p>
                <p className="text-muted-foreground text-sm">{admin.dataSetVersion}</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
