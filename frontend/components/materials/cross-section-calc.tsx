"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { Material } from "@/lib/api"
import { num } from "@/lib/format"

const KGF_TO_N = 9.80665

type ForceUnit = "N" | "kgf"

type Props = {
  material: Material
}

function BeamDiagram({ areaMm2, diameterMm, sideMm }: { areaMm2: number; diameterMm: number; sideMm: number }) {
  const clampedD = Math.max(10, Math.min(48, diameterMm * 1.2))
  const clampedS = Math.max(10, Math.min(48, sideMm * 1.2))
  const r = clampedD / 2

  const w = 260
  const h = 130
  const beamY = h / 2
  const beamH = 8
  const beamLeft = 10
  const beamRight = w * 0.50
  const crossCx = w * 0.73
  const crossCy = h / 2

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full text-foreground"
      role="img"
      aria-label={`Cross-section: ${num(areaMm2)} mm²`}
    >
      {/* Beam side view */}
      <rect
        x={beamLeft} y={beamY - beamH / 2}
        width={beamRight - beamLeft} height={beamH}
        className="fill-muted stroke-foreground"
        strokeWidth={1.5}
      />

      {/* Force arrow */}
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" className="fill-foreground" />
        </marker>
      </defs>
      <line x1={beamLeft - 2} y1={beamY} x2={beamLeft + 26} y2={beamY} className="stroke-foreground" strokeWidth={1.5} markerEnd="url(#ah)" />
      <text x={beamLeft + 12} y={beamY - beamH - 3} textAnchor="middle" className="fill-muted-foreground text-[9px]">F</text>

      {/* Cut line */}
      <line x1={beamRight} y1={beamY - 26} x2={beamRight} y2={beamY + 26} className="stroke-foreground" strokeWidth={0.8} strokeDasharray="3 2" />

      {/* Circle cross-section */}
      <circle cx={crossCx} cy={crossCy - clampedD / 2 - 6} r={r} className="fill-muted stroke-foreground" strokeWidth={1.5} />
      <clipPath id="cc"><circle cx={crossCx} cy={crossCy - clampedD / 2 - 6} r={r - 1} /></clipPath>
      <g clipPath="url(#cc)" className="stroke-foreground/20" strokeWidth={0.5}>
        {Array.from({ length: Math.ceil(clampedD / 3) }, (_, i) => {
          const off = -clampedD + i * 3
          const cy = crossCy - clampedD / 2 - 6
          return <line key={i} x1={crossCx + off} y1={cy - r} x2={crossCx + off + clampedD} y2={cy + r} />
        })}
      </g>
      <line x1={crossCx - r} y1={crossCy - clampedD / 2 - 6} x2={crossCx + r} y2={crossCy - clampedD / 2 - 6} className="stroke-gauge-strength" strokeWidth={1} />
      <text x={crossCx} y={crossCy - clampedD / 2 - 6 + 3} textAnchor="middle" className="fill-gauge-strength text-[8px] font-medium">
        ⌀{num(diameterMm)}
      </text>

      {/* Square cross-section */}
      <rect x={crossCx - clampedS / 2} y={crossCy + 6} width={clampedS} height={clampedS} className="fill-muted stroke-foreground" strokeWidth={1.5} />
      <clipPath id="sc"><rect x={crossCx - clampedS / 2 + 1} y={crossCy + 7} width={clampedS - 2} height={clampedS - 2} /></clipPath>
      <g clipPath="url(#sc)" className="stroke-foreground/20" strokeWidth={0.5}>
        {Array.from({ length: Math.ceil(clampedS / 3) * 2 }, (_, i) => {
          const off = -clampedS + i * 3
          const sx = crossCx - clampedS / 2
          const sy = crossCy + 6
          return <line key={i} x1={sx + off} y1={sy} x2={sx + off + clampedS} y2={sy + clampedS} />
        })}
      </g>
      <line x1={crossCx - clampedS / 2} y1={crossCy + 6 + clampedS + 4} x2={crossCx + clampedS / 2} y2={crossCy + 6 + clampedS + 4} className="stroke-gauge-strength" strokeWidth={1} />
      <text x={crossCx} y={crossCy + 6 + clampedS + 12} textAnchor="middle" className="fill-gauge-strength text-[8px] font-medium">
        {num(sideMm)}
      </text>

      <text x={crossCx} y={12} textAnchor="middle" className="fill-muted-foreground text-[8px]">min cross-section</text>
    </svg>
  )
}

export function CrossSectionCalc({ material }: Props) {
  const [forceInput, setForceInput] = React.useState("100")
  const [safetyFactor, setSafetyFactor] = React.useState("2")
  const [unit, setUnit] = React.useState<ForceUnit>("N")

  const uts = material.uts_mpa
  const rawForce = Number(forceInput) || 0
  const forceN = unit === "kgf" ? rawForce * KGF_TO_N : rawForce
  const sf = Number(safetyFactor) || 2

  const valid = uts !== null && uts > 0 && forceN > 0 && sf > 0
  const allowableStress = valid ? uts! / sf : 0
  const areaMm2 = allowableStress > 0 ? forceN / allowableStress : 0
  const diameterMm = areaMm2 > 0 ? Math.sqrt((4 * areaMm2) / Math.PI) : 0
  const sideMm = areaMm2 > 0 ? Math.sqrt(areaMm2) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cross-section calculator</CardTitle>
        <CardDescription>
          Minimum cross-sectional area to carry a tensile load in {material.name}
          {uts !== null && <> (UTS {num(uts)} MPa)</>}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-4">
            <FieldGroup>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <Field>
                  <FieldLabel htmlFor="calc-force">Force ({unit})</FieldLabel>
                  <Input
                    id="calc-force"
                    type="number"
                    min={0}
                    step="any"
                    value={forceInput}
                    onChange={(e) => setForceInput(e.target.value)}
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-0.5"
                  onClick={() => {
                    setUnit((u) => {
                      const next = u === "N" ? "kgf" : "N"
                      // Convert the displayed number so the physical force stays the same
                      const currentN = u === "kgf" ? rawForce * KGF_TO_N : rawForce
                      const converted = next === "kgf" ? currentN / KGF_TO_N : currentN
                      setForceInput(String(Math.round(converted * 100) / 100))
                      return next
                    })
                  }}
                >
                  {unit === "N" ? "→ kgf" : "→ N"}
                </Button>
                <Field>
                  <FieldLabel htmlFor="calc-sf">Safety factor</FieldLabel>
                  <Input
                    id="calc-sf"
                    type="number"
                    min={1}
                    step={0.5}
                    value={safetyFactor}
                    onChange={(e) => setSafetyFactor(e.target.value)}
                  />
                  <FieldDescription>Divides UTS. 2 is typical.</FieldDescription>
                </Field>
              </div>
            </FieldGroup>

            <Separator />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Allowable stress</div>
                <div className="text-lg font-semibold tabular-nums">
                  {valid ? `${num(allowableStress)} MPa` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Required area</div>
                <div className="text-lg font-semibold tabular-nums">
                  {valid ? `${num(areaMm2)} mm²` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Circle ⌀</div>
                <div className="font-medium tabular-nums">{valid ? `${num(diameterMm)} mm` : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Square side</div>
                <div className="font-medium tabular-nums">{valid ? `${num(sideMm)} mm` : "—"}</div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Simple tensile stress (A = F / σ). Does not account for layer orientation,
              infill, bending, fatigue, creep, or moisture. Z-axis layer adhesion is 40–70% of XY.
            </p>
          </div>

          {/* Diagram always visible */}
          <div className="flex w-56 items-center">
            <BeamDiagram
              areaMm2={valid ? areaMm2 : 10}
              diameterMm={valid ? diameterMm : 3.6}
              sideMm={valid ? sideMm : 3.2}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
