"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type ChartBounds, type MaterialDetail, type MaterialSummary } from "@/lib/api"
import { tempRange } from "@/lib/format"

import { CrossSectionCalc } from "./cross-section-calc"
import { MaterialsSidebar } from "./materials-sidebar"
import { PropertyGauges } from "./property-gauges"
import { StressStrainChart } from "./stress-strain-chart"
import { SupportTable } from "./support-table"

/* ---------- small layout pieces ---------- */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

const DASH = "—"

/* ---------- main component ---------- */

export function MaterialsExplorer() {
  const [materials, setMaterials] = React.useState<MaterialSummary[]>([])
  const [notes, setNotes] = React.useState<string[]>([])
  const [chartBounds, setChartBounds] = React.useState<ChartBounds>({ max_stress_mpa: 250, strain_presets: [25, 50, 100, 250, 500] })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<MaterialDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    api
      .materials()
      .then((res) => {
        if (cancelled) return
        setMaterials(res.materials)
        setNotes(res.notes)
        setChartBounds(res.chart_bounds)
        setSelectedId((current) => current ?? res.materials.find((m) => m.id === "petg")?.id ?? res.materials[0]?.id ?? null)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    api
      .material(selectedId)
      .then((res) => {
        if (cancelled) return
        setDetail(res)
        setError(null)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const m = detail?.material ?? null
  const b = m?.bambu ?? null

  return (
    <>
      <MaterialsSidebar
        materials={materials}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{m?.name ?? "Materials"}</h1>
          </div>
          {m && (
            <div className="flex items-center gap-2">
              {m.heated_chamber && <Badge variant="secondary">Chamber</Badge>}
              {m.hardened_nozzle && <Badge variant="secondary">Hardened nozzle</Badge>}
              <Badge variant="outline">{m.curve_class}</Badge>
            </div>
          )}
        </header>

        <div className="flex flex-col gap-6 p-4 md:p-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>Could not load material data</AlertTitle>
              <AlertDescription>{error}. Is the Flask API running on port 5328?</AlertDescription>
            </Alert>
          )}

          {/* Loading skeleton matches the gauge + chart layout */}
          {!m && !error && (
            <div className="flex flex-col gap-6">
              <Skeleton className="h-80" />
              <div className="grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-80 lg:col-span-2" />
                <Skeleton className="h-80" />
              </div>
            </div>
          )}

          {m && (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <div className="flex flex-col gap-6">
                {/* Property gauges — fixed row count, no wrapping */}
                <PropertyGauges material={m} />

                {/* Chart + Print settings */}
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <StressStrainChart
                      curve={detail?.curve ?? { points: [], markers: {}, model: "unavailable", curve_class: "unknown" }}
                      materialName={m.name}
                      failsBy={m.fails_by}
                      bounds={chartBounds}
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Print settings</CardTitle>
                      <CardDescription>
                        {b ? `Bambu Lab ${b.name}` : "Typical starting points"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col divide-y">
                      <Row label="Nozzle" value={tempRange(m.nozzle_c)} />
                      <Row label="Bed" value={tempRange(m.bed_c)} />
                      <Row label="Chamber" value={tempRange(m.chamber_c)} />
                      <Row label="Hardened nozzle" value={m.hardened_nozzle ? "Yes" : "No"} />
                      <Row label="Nozzle sizes" value={b?.nozzle_sizes ? b.nozzle_sizes.join(" / ") : "All"} />
                      <Row label="Must dry" value={m.must_dry} />
                      <Row
                        label="Drying"
                        value={
                          b?.drying_condition
                            ? <span className="whitespace-pre-line text-xs">{b.drying_condition}</span>
                            : DASH
                        }
                      />
                      <Row label="AMS compatible" value={m.ams2_pro} />
                      <Row label="Seal with desiccant" value={b?.seal_with_desiccant ? "Yes" : "No"} />
                      <Row label="Part cooling fan" value={b?.part_cooling_fan ?? DASH} />
                      <Row label="Shrinkage" value={m.shrinkage_pct !== null ? `${m.shrinkage_pct.toFixed(2)}%` : DASH} />
                      <Row label="Creep at RT" value={m.creep_rt ?? DASH} />
                      <Row
                        label="Build plate"
                        value={
                          b?.build_plate
                            ? <span className="text-xs">{b.build_plate.map((p) => `${p.plate} ${tempRange(p.temp_c)}`).join(", ")}</span>
                            : DASH
                        }
                      />
                      <Row label="Adhesion" value={b?.adhesion_methods ?? DASH} />
                      {b?.annealing && (
                        <Row
                          label="Annealing"
                          value={`${tempRange(b.annealing.temp_c)}, ${b.annealing.hours ? `${b.annealing.hours[0]}–${b.annealing.hours[1]} h` : ""}`}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Cross-section calculator */}
                <CrossSectionCalc material={m} />

                {/* Watch for */}
                <Alert>
                  <AlertTriangleIcon />
                  <AlertTitle>Watch for</AlertTitle>
                  <AlertDescription>
                    <p>{m.watch_for}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.breakaway_support && <Badge variant="secondary">Breakaway: {m.breakaway_support}</Badge>}
                      {m.soluble_support && m.soluble_support !== "—" && <Badge variant="secondary">Soluble: {m.soluble_support}</Badge>}
                      {m.do_not_use_as_support && (
                        <Badge variant="destructive">Not as support: {m.do_not_use_as_support}</Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Support table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Support materials for {m.name}</CardTitle>
                    <CardDescription>
                      Pairing matrix + dual-nozzle check. Nozzle temperatures are independent per head.
                      Bed and chamber are shared.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {detail && <SupportTable supports={detail.supports} partName={m.name} />}
                  </CardContent>
                </Card>

                {/* Notes */}
                {notes.length > 0 && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">Notes on the data</summary>
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                      {notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
