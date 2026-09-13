import { useEffect, useState, type FormEvent } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LangTextField } from "@/components/ilcd/lang-text-field"
import { DatasetRefField } from "@/components/ilcd/dataset-ref-field"
import { createDataset, getDataset, updateDataset, type Dataset } from "@/lib/datasets"
import { supabase } from "@/lib/supabase"
import { useSessionStore } from "@/state/session"
import { emptyRef, getLangText, toContactDataSet, type ContactDataSet, type DatasetRef } from "@/lib/ilcd"

export function ContactForm() {
  const { id } = useParams<{ id?: string }>()
  const session = useSessionStore((s) => s.session)
  const navigate = useNavigate()

  const [ds, setDs] = useState<ContactDataSet>(() => toContactDataSet(undefined))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<Dataset | null | undefined>(
    id ? undefined : null,
  )

  useEffect(() => {
    if (!id) return
    getDataset(id).then((d) => {
      setExisting(d ?? null)
      if (d) setDs(toContactDataSet(d.payload))
    })
  }, [id])

  if (!session) return <Navigate to="/sign-in" replace />
  if (id && existing === undefined) return null
  if (id && existing === null) {
    return <p className="text-muted-foreground">Not found.</p>
  }

  const info = ds.contactInformation.dataSetInformation
  const admin = ds.administrativeInformation

  function updateInfo(patch: Partial<ContactDataSet["contactInformation"]["dataSetInformation"]>) {
    setDs((prev) => ({
      ...prev,
      contactInformation: {
        dataSetInformation: { ...prev.contactInformation.dataSetInformation, ...patch },
      },
    }))
  }
  function updateAdmin(patch: Partial<ContactDataSet["administrativeInformation"]>) {
    setDs((prev) => ({
      ...prev,
      administrativeInformation: { ...prev.administrativeInformation, ...patch },
    }))
  }

  function addRelatedContact() {
    updateInfo({ referenceToContact: [...info.referenceToContact, emptyRef("contact")] })
  }
  function updateRelatedContact(i: number, value: DatasetRef) {
    updateInfo({
      referenceToContact: info.referenceToContact.map((r, idx) => (idx === i ? value : r)),
    })
  }
  function removeRelatedContact(i: number) {
    updateInfo({ referenceToContact: info.referenceToContact.filter((_, idx) => idx !== i) })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const name =
      getLangText(info.name, "en") || getLangText(info.shortName, "en") || "Untitled contact"
    const description = getLangText(info.generalComment, "en") || null

    try {
      const input = { type: "contact" as const, name, description, payload: ds as unknown as Record<string, unknown> }
      const dataset = id ? await updateDataset(id, input) : await createDataset(input)
      navigate(`/open-data/contact/${dataset.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{id ? "Edit" : "Add"} Contact</CardTitle>
      </CardHeader>
      <CardContent>
        {!supabase ? (
          <p className="text-muted-foreground text-sm">
            Supabase isn't configured for this deployment (missing{" "}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            ), so {id ? "editing" : "adding"} contacts is unavailable.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Tabs defaultValue="info">
              <TabsList className="h-auto w-full flex-wrap items-start justify-start gap-1 group-data-horizontal/tabs:h-auto [&>*]:flex-none">
                <TabsTrigger value="info">Contact information</TabsTrigger>
                <TabsTrigger value="admin">Administrative information</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex flex-col gap-6 pt-6">
                <LangTextField
                  label="Short name"
                  required
                  value={info.shortName}
                  onChange={(v) => updateInfo({ shortName: v })}
                />
                <LangTextField
                  label="Name"
                  required
                  value={info.name}
                  onChange={(v) => updateInfo({ name: v })}
                />
                <div className="flex flex-col gap-2">
                  <Label>Classification</Label>
                  <Input
                    placeholder="Data provider / Background database (path, separated by /)"
                    value={info.classification.join(" / ")}
                    onChange={(e) =>
                      updateInfo({
                        classification: e.target.value.split("/").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={info.email}
                      onChange={(e) => updateInfo({ email: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="wwwAddress">Website</Label>
                    <Input
                      id="wwwAddress"
                      type="url"
                      value={info.wwwAddress}
                      onChange={(e) => updateInfo({ wwwAddress: e.target.value })}
                    />
                  </div>
                </div>
                <LangTextField
                  label="Central contact point"
                  value={info.centralContactPoint}
                  onChange={(v) => updateInfo({ centralContactPoint: v })}
                />
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="contactAddress">Address</Label>
                    <Input
                      id="contactAddress"
                      value={info.contactAddress}
                      onChange={(e) => updateInfo({ contactAddress: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="telephone">Telephone</Label>
                    <Input
                      id="telephone"
                      value={info.telephone}
                      onChange={(e) => updateInfo({ telephone: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="telefax">Telefax</Label>
                    <Input
                      id="telefax"
                      value={info.telefax}
                      onChange={(e) => updateInfo({ telefax: e.target.value })}
                    />
                  </div>
                </div>
                <LangTextField
                  label="General comment"
                  multiline
                  value={info.generalComment}
                  onChange={(v) => updateInfo({ generalComment: v })}
                />
                <div className="flex flex-col gap-2">
                  <Label>Related contacts</Label>
                  {info.referenceToContact.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <DatasetRefField
                          label=""
                          value={r}
                          onChange={(v) => updateRelatedContact(i, v)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRelatedContact(i)}
                        aria-label="Remove related contact"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRelatedContact}
                    className="self-start"
                  >
                    <Plus className="size-4" />
                    Add related contact
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="flex flex-col gap-6 pt-6">
                <DatasetRefField
                  label="Reference to ownership of data set"
                  value={admin.referenceToOwnershipOfDataSet}
                  onChange={(v) => updateAdmin({ referenceToOwnershipOfDataSet: v })}
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
