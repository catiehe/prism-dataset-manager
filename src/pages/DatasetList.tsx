import { useEffect, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { Eye, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  deleteDataset,
  type Dataset,
  type DatasetType,
  getDatasetTypeInfo,
  listDatasets,
} from "@/lib/datasets"
import { useSessionStore } from "@/state/session"

export function DatasetList() {
  const { type } = useParams<{ type: string }>()
  const typeInfo = type ? getDatasetTypeInfo(type) : undefined
  const session = useSessionStore((s) => s.session)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Dataset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!typeInfo) return
    listDatasets(typeInfo.type as DatasetType).then(setDatasets)
  }, [typeInfo])

  if (!typeInfo) {
    return <Navigate to="/open-data/process" replace />
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteDataset(deleteTarget.id)
      setDatasets((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{typeInfo.label}</CardTitle>
        <Button asChild size="sm" className="self-start sm:self-auto">
          <Link to={`/open-data/${typeInfo.type}/new`}>
            <Plus className="size-4" />
            Add
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="whitespace-nowrap">Scope</TableHead>
              <TableHead className="whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datasets.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    to={`/open-data/${typeInfo.type}/${d.id}`}
                    className="text-primary hover:underline"
                  >
                    {d.name}
                  </Link>
                </TableCell>
                <TableCell
                  className="max-w-0 w-full truncate text-muted-foreground"
                  title={d.description ?? undefined}
                >
                  {d.description}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {d.visibility === "public" ? "Open Data" : "My Data"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View ${d.name}`}
                    >
                      <Link to={`/open-data/${typeInfo.type}/${d.id}`}>
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                    {typeInfo.type === "model" && (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open ${d.name} in Product Graph Editor`}
                      >
                        <a
                          href="https://calvinw.github.io/product-graph-editor/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    )}
                    {session?.user.id === d.created_by && (
                      <>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${d.name}`}
                        >
                          <Link to={`/open-data/${typeInfo.type}/${d.id}/edit`}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${d.name}`}
                          onClick={() => {
                            setDeleteError(null)
                            setDeleteTarget(d)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {datasets.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No {typeInfo.label.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-destructive text-sm">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
