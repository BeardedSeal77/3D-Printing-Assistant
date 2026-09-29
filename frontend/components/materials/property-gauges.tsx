"use client"

import { cn } from "@/lib/utils"
import { num } from "@/lib/format"
import type { Material } from "@/lib/api"

/* ---------- gauge row ---------- */

type GaugeProps = {
  label: string
  sublabel?: string
  value: number | null
  max: number
  unit: string
  color: string
}

function Gauge({ label, sublabel, value, max, unit, color }: GaugeProps) {
  const pct = value !== null && max > 0 ? Math.min((value / max) * 100, 100) : 0
  const segments = 5

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-36 shrink-0">
        <div className="text-sm font-medium">{label}</div>
        {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
      </div>
      <div className="flex flex-1 items-center gap-2">
        <div className="flex flex-1 gap-0.5">
          {Array.from({ length: segments }, (_, i) => {
            const segStart = (i / segments) * 100
            const filled = pct > segStart
            const partial = pct > segStart && pct < ((i + 1) / segments) * 100
            return (
              <div
                key={i}
                className={cn(
                  "h-2.5 flex-1 rounded-sm transition-all duration-300",
                  filled ? "" : "bg-muted",
                  partial ? "opacity-70" : ""
                )}
                style={filled ? { backgroundColor: `var(--${color})` } : undefined}
              />
            )
          })}
        </div>
        <div className="w-24 text-right text-sm tabular-nums">
          {value !== null ? `${num(value)} ${unit}` : "—"}
        </div>
      </div>
    </div>
  )
}

/* ---------- property panel ---------- */

// Max values across all Bambu-tested filaments for normalising gauges.
// Picked so the strongest material fills about 80–90% of the bar.
const MAXES = {
  toughness: 130,   // TPU 95A is ~123
  strength: 250,    // PPA-CF is 208
  stiffness: 10000, // PPA-CF is 9860
  adhesion: 90,     // TPU 95A HF is 86
  hdt: 270,         // PPS-CF would be 264, PPA-CF is 227
  water: 7,         // PVA is 6.25%
}

type Props = {
  material: Material
}

export function PropertyGauges({ material: m }: Props) {
  const b = m.bambu

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Filament properties
      </div>
      <div className="divide-y">
        <Gauge
          label="Toughness"
          sublabel="Impact strength · XY"
          value={b?.toughness_kj_m2 ?? null}
          max={MAXES.toughness}
          unit="kJ/m²"
          color="gauge-toughness"
        />
        <Gauge
          label="Strength"
          sublabel="Tensile · XY"
          value={m.uts_mpa}
          max={MAXES.strength}
          unit="MPa"
          color="gauge-strength"
        />
        <Gauge
          label="Stiffness"
          sublabel="Young's modulus · XY"
          value={m.modulus_gpa !== null ? m.modulus_gpa * 1000 : null}
          max={MAXES.stiffness}
          unit="MPa"
          color="gauge-stiffness"
        />
        <Gauge
          label="Layer adhesion"
          sublabel="Impact strength · Z"
          value={b?.layer_adhesion_mpa ?? null}
          max={MAXES.adhesion}
          unit="kJ/m²"
          color="gauge-adhesion"
        />
        <Gauge
          label="Heat resistance"
          sublabel="HDT, 0.45 MPa"
          value={m.hdt_c}
          max={MAXES.hdt}
          unit="°C"
          color="gauge-heat"
        />
        <Gauge
          label="Water absorption"
          sublabel="Saturated, 25 °C"
          value={b?.water_absorption_pct ?? null}
          max={MAXES.water}
          unit="%"
          color="gauge-water"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Fixture: {m.fixture_rating}</span>
        <span>Stiffness rank {m.stiffness_rank ?? "—"}</span>
        <span>Heat rank {m.heat_rank ?? "—"}</span>
        {b?.print_speed_mm_s != null && <span>Max {b.print_speed_mm_s} mm/s</span>}
      </div>
    </div>
  )
}
