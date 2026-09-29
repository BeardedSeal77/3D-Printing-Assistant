import { SidebarProvider } from "@/components/ui/sidebar"
import { MaterialsExplorer } from "@/components/materials/materials-explorer"

export default function Page() {
  return (
    <SidebarProvider>
      <MaterialsExplorer />
    </SidebarProvider>
  )
}
