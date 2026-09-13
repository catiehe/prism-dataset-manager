import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDataset, type Dataset } from "@/lib/datasets"
import { toContactDataSet } from "@/lib/ilcd"
import { LangRow } from "@/components/ilcd/lang-row"

export function ContactDetail() {
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

  const ds = toContactDataSet(dataset.payload)
  const info = ds.contactInformation.dataSetInformation
  const admin = ds.administrativeInformation

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link to="/open-data/contact" className="text-sm text-muted-foreground hover:underline">
        ← Back to Contacts
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info">
            <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-2 p-2 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
              <TabsTrigger value="info">Contact information</TabsTrigger>
              <TabsTrigger value="admin">Administrative information</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex flex-col gap-6 pt-6">
              <p className="text-muted-foreground text-xs">ID: {dataset.id}</p>
              <LangRow label="Short name" value={info.shortName} />
              <LangRow label="Name" value={info.name} />
              {info.classification.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Classification</p>
                  <p className="text-muted-foreground text-sm">{info.classification.join(" / ")}</p>
                </div>
              )}
              <div className="flex gap-8">
                {info.email && (
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-muted-foreground text-sm">{info.email}</p>
                  </div>
                )}
                {info.wwwAddress && (
                  <div>
                    <p className="text-sm font-medium">Website</p>
                    <p className="text-muted-foreground text-sm">{info.wwwAddress}</p>
                  </div>
                )}
              </div>
              <LangRow label="Central contact point" value={info.centralContactPoint} />
              <div className="flex gap-8">
                {info.contactAddress && (
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-muted-foreground text-sm">{info.contactAddress}</p>
                  </div>
                )}
                {info.telephone && (
                  <div>
                    <p className="text-sm font-medium">Telephone</p>
                    <p className="text-muted-foreground text-sm">{info.telephone}</p>
                  </div>
                )}
                {info.telefax && (
                  <div>
                    <p className="text-sm font-medium">Telefax</p>
                    <p className="text-muted-foreground text-sm">{info.telefax}</p>
                  </div>
                )}
              </div>
              <LangRow label="General comment" value={info.generalComment} />
              {info.referenceToContact.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Related contacts</p>
                  <ul className="text-muted-foreground text-sm">
                    {info.referenceToContact.map((r, i) => (
                      <li key={i}>{r.shortDescription || r.refObjectId}</li>
                    ))}
                  </ul>
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
