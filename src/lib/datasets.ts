import { supabase } from "@/lib/supabase"

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    )
  }
  return supabase
}

export type DatasetType =
  | "model"
  | "process"
  | "flow"
  | "flow_property"
  | "unit_group"
  | "source"
  | "contact"

export interface Dataset {
  id: string
  type: DatasetType
  name: string
  description: string | null
  payload: Record<string, unknown>
  created_by: string | null
  visibility: "public" | "private"
  import_batch_id: string | null
  created_at: string
}

export interface DatasetTypeInfo {
  type: DatasetType
  label: string
  singular: string
}

export const DATASET_TYPES: DatasetTypeInfo[] = [
  { type: "model", label: "Models", singular: "Model" },
  { type: "process", label: "Processes", singular: "Process" },
  { type: "flow", label: "Flows", singular: "Flow" },
  { type: "flow_property", label: "Flow Properties", singular: "Flow Property" },
  { type: "unit_group", label: "Unit Groups", singular: "Unit Group" },
  { type: "source", label: "Sources", singular: "Source" },
  { type: "contact", label: "Contacts", singular: "Contact" },
]

export function getDatasetTypeInfo(type: string): DatasetTypeInfo | undefined {
  return DATASET_TYPES.find((t) => t.type === type)
}

export async function listDatasets(type: DatasetType): Promise<Dataset[]> {
  const { data, error } = await requireSupabase()
    .from("datasets")
    .select("*")
    .eq("type", type)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data as Dataset[]
}

export async function getDataset(id: string): Promise<Dataset | undefined> {
  const { data, error } = await requireSupabase()
    .from("datasets")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export interface NewDataset {
  type: DatasetType
  name: string
  description: string | null
  payload: Record<string, unknown>
}

export async function createDataset(input: NewDataset): Promise<Dataset> {
  if (!supabase) {
    throw new Error("Supabase is not configured, so datasets can't be added.")
  }
  const { data, error } = await supabase
    .from("datasets")
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Dataset
}

export async function updateDataset(id: string, input: NewDataset): Promise<Dataset> {
  if (!supabase) {
    throw new Error("Supabase is not configured, so datasets can't be edited.")
  }
  const { data, error } = await supabase
    .from("datasets")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data as Dataset
}

export async function deleteDataset(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured, so datasets can't be deleted.")
  }
  const { error } = await supabase.from("datasets").delete().eq("id", id)
  if (error) throw error
}
