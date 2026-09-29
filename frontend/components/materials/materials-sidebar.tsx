"use client"

import * as React from "react"
import {
  FlaskConicalIcon,
  ThermometerIcon,
  LayersIcon,
  ZapIcon,
  ShieldIcon,
  CircleDotIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { MaterialSummary } from "@/lib/api"

type Category = {
  label: string
  icon: React.ElementType
  ids: string[]
}

const CATEGORIES: Category[] = [
  { label: "PLA", icon: LayersIcon, ids: ["pla", "pla-cf"] },
  { label: "PETG", icon: FlaskConicalIcon, ids: ["petg", "petg-cf"] },
  { label: "ABS / ASA", icon: ThermometerIcon, ids: ["abs", "asa"] },
  { label: "Nylon (PA)", icon: ZapIcon, ids: ["pa6", "pa6-cf", "pa6-gf", "ppa-cf"] },
  { label: "Engineering", icon: ShieldIcon, ids: ["pc", "pet-cf"] },
  { label: "Flexible", icon: CircleDotIcon, ids: ["tpu-95a"] },
]

type Props = {
  materials: MaterialSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function MaterialsSidebar({ materials, selectedId, onSelect }: Props) {
  const byId = React.useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  // Materials that exist in data but aren't in any category
  const categorizedIds = new Set(CATEGORIES.flatMap((c) => c.ids))
  const uncategorized = materials.filter((m) => !categorizedIds.has(m.id))

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FlaskConicalIcon className="size-5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Filaments</div>
            <div className="text-xs text-muted-foreground">{materials.length} materials</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {CATEGORIES.map((cat) => {
          const items = cat.ids.map((id) => byId.get(id)).filter(Boolean) as MaterialSummary[]
          if (items.length === 0) return null
          return (
            <SidebarGroup key={cat.label}>
              <SidebarGroupLabel>
                <cat.icon className="mr-1.5" />
                {cat.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((mat) => (
                    <SidebarMenuItem key={mat.id}>
                      <SidebarMenuButton
                        isActive={mat.id === selectedId}
                        onClick={() => onSelect(mat.id)}
                      >
                        {mat.name}
                      </SidebarMenuButton>
                      <SidebarMenuBadge>{mat.hdt_c ? `${mat.hdt_c}°C` : ""}</SidebarMenuBadge>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
        {uncategorized.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Other</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {uncategorized.map((mat) => (
                  <SidebarMenuItem key={mat.id}>
                    <SidebarMenuButton
                      isActive={mat.id === selectedId}
                      onClick={() => onSelect(mat.id)}
                    >
                      {mat.name}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
