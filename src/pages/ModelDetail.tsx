import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Star } from "lucide-react"
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
import { toModelDataSet } from "@/lib/ilcd"
import { LangRow } from "@/components/ilcd/lang-row"

export function ModelDetail() {
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

  const ds = toModelDataSet(dataset.payload)
  const info = ds.modelInformation
  const model = ds.modellingAndValidation
  const admin = ds.administrativeInformation

  function instanceLabel(id: number): string {
    const inst = ds.processInstances.find((i) => i.dataSetInternalID === id)
    return inst ? inst.referenceToProcess.shortDescription || "Untitled" : `#${id}`
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link to="/open-data/model" className="text-sm text-muted-foreground hover:underline">
        ← Back to Models
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info">
            <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-1 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
              <TabsTrigger value="info">Model information</TabsTrigger>
              <TabsTrigger value="model">Modelling and validation</TabsTrigger>
              <TabsTrigger value="admin">Administrative information</TabsTrigger>
              <TabsTrigger value="instances">Process instances</TabsTrigger>
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
              {admin.referenceToCommissioner.shortDescription && (
                <div>
                  <p className="text-sm font-medium">Reference to commissioner</p>
                  <p className="text-muted-foreground text-sm">
                    {admin.referenceToCommissioner.shortDescription}
                  </p>
                </div>
              )}
              <LangRow label="Intended applications" value={admin.intendedApplications} />
              <div className="flex gap-8">
                <div>
                  <p className="text-sm font-medium">Data set version</p>
                  <p className="text-muted-foreground text-sm">{admin.dataSetVersion}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Copyright</p>
                  <p className="text-muted-foreground text-sm">{admin.copyright ? "Yes" : "No"}</p>
                </div>
              </div>
              {admin.referenceToOwnershipOfDataSet.shortDescription && (
                <div>
                  <p className="text-sm font-medium">Reference to ownership of data set</p>
                  <p className="text-muted-foreground text-sm">
                    {admin.referenceToOwnershipOfDataSet.shortDescription}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="instances" className="flex flex-col gap-6 pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Process</TableHead>
                    <TableHead>Multiplication factor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ds.processInstances.map((inst) => (
                    <TableRow key={inst.dataSetInternalID}>
                      <TableCell>
                        {info.quantitativeReference.referenceToReferenceProcess ===
                          inst.dataSetInternalID && (
                          <Star className="fill-primary text-primary size-4" />
                        )}
                      </TableCell>
                      <TableCell>{inst.referenceToProcess.shortDescription}</TableCell>
                      <TableCell>{inst.multiplicationFactor ?? ""}</TableCell>
                    </TableRow>
                  ))}
                  {ds.processInstances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No process instances yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {ds.connections.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ds.connections.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{instanceLabel(c.fromInstanceId)}</TableCell>
                        <TableCell>{instanceLabel(c.toInstanceId)}</TableCell>
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
