import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DatasetList } from "@/pages/DatasetList"
import { DatasetDetail } from "@/pages/DatasetDetail"
import { SignIn } from "@/pages/SignIn"
import { DatasetForm } from "@/pages/DatasetForm"
import { ImportOpenLca } from "@/pages/ImportOpenLca"
import { ExportOpenLca } from "@/pages/ExportOpenLca"

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <span className="font-medium">PRISM LCA</span>
            </header>
            <main className="flex-1 overflow-auto p-4">
              <Routes>
                <Route path="/" element={<Navigate to="/open-data/process" replace />} />
                <Route path="/open-data/:type" element={<DatasetList />} />
                <Route path="/open-data/:type/new" element={<DatasetForm />} />
                <Route path="/open-data/:type/:id/edit" element={<DatasetForm />} />
                <Route path="/open-data/:type/:id" element={<DatasetDetail />} />
                <Route path="/import" element={<ImportOpenLca />} />
                <Route path="/export" element={<ExportOpenLca />} />
                <Route path="/sign-in" element={<SignIn />} />
              </Routes>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
