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
import { getDataset, type Dataset } from "@/lib/datasets"
import { toUnitGroupDataSet } from "@/lib/ilcd"
import { LangRow } from "@/components/ilcd/lang-row"

export function UnitGroupDetail() {
  const { id } = useParams<{ id: string }>()
  const [dataset, setDataset] = useState<Dataset | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => setDataset(d ?? null))
  }, [id])

  if (dataset === undefined) return null
  if (dataset === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const ds = toUnitGroupDataSet(dataset.payload)
  const info = ds.unitGroupInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link to="/open-data/unit_group" className="text-sm text-muted-foreground hover:underline">
        ← Back to Unit Groups
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info">
            <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-2 p-2 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
              <TabsTrigger value="info">Unit group information</TabsTrigger>
              <TabsTrigger value="model">Modelling and validation</TabsTrigger>
              <TabsTrigger value="admin">Administrative information</TabsTrigger>
              <TabsTrigger value="units">Units</TabsTrigger>
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
            </TabsContent>

            <TabsContent value="model" className="pt-6">
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

            <TabsContent value="units" className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Index</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Mean value (of unit)</TableHead>
                    <TableHead>Quantitative reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ds.units.map((u) => {
                    const isReference =
                      info.quantitativeReference.referenceToReferenceUnit === u.dataSetInternalID
                    return (
                      <TableRow key={u.dataSetInternalID}>
                        <TableCell>{u.dataSetInternalID}</TableCell>
                        <TableCell>{u.name}</TableCell>
                        <TableCell>
                          {u.generalComment.length > 0
                            ? u.generalComment.map((c) => c.text).join(" / ")
                            : "-"}
                        </TableCell>
                        <TableCell>{u.meanValue ?? ""}</TableCell>
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
                  {ds.units.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No units yet.
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
