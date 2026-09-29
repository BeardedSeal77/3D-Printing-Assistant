"use client"

import { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ChartBounds, Curve } from "@/lib/api"
import { num } from "@/lib/format"

const chartConfig = {
  stress_mpa: {
    label: "Stress (MPa)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

type Props = {
  curve: Curve
  materialName: string
  failsBy: string
  bounds: ChartBounds
}

function pickStrainMax(curve: Curve, presets: number[]): number {
  if (curve.points.length === 0) return presets[0] ?? 25
  const maxStrain = Math.max(...curve.points.map((p) => p.strain_pct))
  for (const preset of presets) {
    if (maxStrain <= preset) return preset
  }
  return presets[presets.length - 1] ?? 500
}

export function StressStrainChart({ curve, materialName, failsBy, bounds }: Props) {
  const empty = curve.model === "unavailable" || curve.points.length === 0
  const strainMax = pickStrainMax(curve, bounds.strain_presets)

  const { yield: yieldPt, uts, break: breakPt } = empty ? {} as Curve["markers"] : curve.markers
  const markers = empty
    ? []
    : ([
        yieldPt && { key: "yield", label: "Yield", point: yieldPt },
        uts && { key: "uts", label: "UTS", point: uts },
        breakPt && { key: "break", label: "Break", point: breakPt },
      ].filter(Boolean) as { key: string; label: string; point: { strain_pct: number; stress_mpa: number } }[])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stress–strain curve</CardTitle>
        <CardDescription>{materialName} · {failsBy}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No curve data available for this material.
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={curve.points}
              margin={{ left: 8, right: 24, top: 16, bottom: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="strain_pct"
                type="number"
                domain={[0, strainMax]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v: number) => `${Math.round(v)}%`}
              />
              <YAxis
                dataKey="stress_mpa"
                type="number"
                domain={[0, bounds.max_stress_mpa]}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value) => `${Number(value).toFixed(1)} MPa`}
                  />
                }
              />
              <Line
                dataKey="stress_mpa"
                type="natural"
                stroke="var(--color-stress_mpa)"
                strokeWidth={2}
                dot={false}
              />
              {markers.map(({ key, label, point }) => (
                <ReferenceDot
                  key={key}
                  x={point.strain_pct}
                  y={point.stress_mpa}
                  r={4}
                  fill="var(--color-stress_mpa)"
                  stroke="var(--background)"
                  strokeWidth={2}
                  label={{
                    value: label,
                    position: key === "yield" ? "top" : "insideTopRight",
                    className: "fill-foreground text-xs",
                  }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          {!empty && curve.model === "illustrative" && curve.inputs && (
            <>
              Representative shape from UTS {num(curve.inputs.uts_mpa)} MPa,
              E {num(curve.inputs.modulus_gpa)} GPa,{" "}
              {num(curve.inputs.elongation_at_break_pct)}% elongation at break.
              Not measured data.
            </>
          )}
          {empty && "No curve data for this material."}
        </div>
      </CardFooter>
    </Card>
  )
}
