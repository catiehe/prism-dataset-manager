import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDataset, type Dataset } from "@/lib/datasets"
import { toSourceDataSet } from "@/lib/ilcd"
import { LangRow } from "@/components/ilcd/lang-row"

export function SourceDetail() {
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

  const ds = toSourceDataSet(dataset.payload)
  const info = ds.sourceInformation.dataSetInformation
  const admin = ds.administrativeInformation

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link to="/open-data/source" className="text-sm text-muted-foreground hover:underline">
        ← Back to Sources
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info">
            <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-2 p-2 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
              <TabsTrigger value="info">Source information</TabsTrigger>
              <TabsTrigger value="admin">Administrative information</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex flex-col gap-6 pt-6">
              <p className="text-muted-foreground text-xs">ID: {dataset.id}</p>
              <LangRow label="Short name" value={info.shortName} />
              {info.classification.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Classification</p>
                  <p className="text-muted-foreground text-sm">{info.classification.join(" / ")}</p>
                </div>
              )}
              {info.sourceCitation && (
                <div>
                  <p className="text-sm font-medium">Source citation</p>
                  <p className="text-muted-foreground text-sm">{info.sourceCitation}</p>
                </div>
              )}
              {info.publicationType && (
                <div>
                  <p className="text-sm font-medium">Publication type</p>
                  <p className="text-muted-foreground text-sm">{info.publicationType}</p>
                </div>
              )}
              <LangRow label="Description or comment" value={info.sourceDescriptionOrComment} />
              {info.referenceToContact.shortDescription && (
                <div>
                  <p className="text-sm font-medium">Reference to contact</p>
                  <p className="text-muted-foreground text-sm">
                    {info.referenceToContact.shortDescription}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
              {admin.referenceToOwnershipOfDataSet.shortDescription && (
                <div>
                  <p className="text-sm font-medium">Reference to ownership of data set</p>
                  <p className="text-muted-foreground text-sm">
                    {admin.referenceToOwnershipOfDataSet.shortDescription}
                  </p>
                </div>
              )}
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
