"use client"

import * as React from "react"
import { AlertTriangleIcon, BoxesIcon, PrinterIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, type MaterialSummary, type Print, type Spool, type Summary } from "@/lib/api"
import { grams, isoDate, minutes, rands, randsPerKg } from "@/lib/format"

import { AddSpoolDialog } from "./add-spool-dialog"
import { LogPrintDialog } from "./log-print-dialog"

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  )
}

function spoolName(s: Spool) {
  return s.label || [s.brand, s.colour].filter(Boolean).join(" ") || `Spool #${s.id}`
}

export function InventoryDashboard() {
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [spools, setSpools] = React.useState<Spool[]>([])
  const [prints, setPrints] = React.useState<Print[]>([])
  const [materials, setMaterials] = React.useState<MaterialSummary[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  const refresh = React.useCallback(async () => {
    try {
      const [sum, sp, pr, mats] = await Promise.all([api.summary(), api.spools(), api.prints(), api.materials()])
      setSummary(sum)
      setSpools(sp.spools)
      setPrints(pr.prints)
      setMaterials(mats.materials)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inventory")
    } finally {
      setLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  async function removeSpool(s: Spool) {
    if (!window.confirm(`Delete spool "${spoolName(s)}"?`)) return
    try {
      await api.deleteSpool(s.id)
      toast.success("Spool deleted")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete spool")
    }
  }

  async function removePrint(p: Print) {
    if (!window.confirm(`Delete print "${p.name}"? Its grams go back onto the spools.`)) return
    try {
      await api.deletePrint(p.id)
      toast.success("Print deleted, grams restored")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete print")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Spools in stock, prints logged against them, and what it all costs.</p>
        </div>
        <div className="flex gap-2">
          <AddSpoolDialog materials={materials} onCreated={refresh} />
          <LogPrintDialog spools={spools} onCreated={refresh} />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Could not load inventory</AlertTitle>
          <AlertDescription>{error}. Is the Flask API running on port 5328?</AlertDescription>
        </Alert>
      )}

      {!loaded ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        summary && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Filament on hand"
              value={grams(summary.stock.remaining_g)}
              hint={`${summary.stock.spool_count} spool${summary.stock.spool_count === 1 ? "" : "s"} · worth ${rands(summary.stock.remaining_value_rands)}`}
            />
            <Stat
              label="Spent on filament"
              value={rands(summary.stock.spent_rands)}
              hint={`${grams(summary.stock.purchased_g)} bought in total`}
            />
            <Stat
              label="Printed"
              value={grams(summary.usage.printed_g)}
              hint={`${summary.usage.print_count} print${summary.usage.print_count === 1 ? "" : "s"} logged`}
            />
            <Stat
              label="Cost of prints"
              value={rands(summary.usage.print_cost_rands)}
              hint={
                summary.usage.printed_g > 0
                  ? `${rands((summary.usage.print_cost_rands / summary.usage.printed_g) * 1000)} per kg used`
                  : "Nothing printed yet"
              }
            />
          </div>
        )
      )}

      <Tabs defaultValue="spools">
        <TabsList>
          <TabsTrigger value="spools">Spools</TabsTrigger>
          <TabsTrigger value="prints">Prints</TabsTrigger>
          <TabsTrigger value="materials">By material</TabsTrigger>
        </TabsList>

        <TabsContent value="spools">
          <Card>
            <CardHeader>
              <CardTitle>Spools</CardTitle>
              <CardDescription>Remaining weight drops as you log prints. Value is what the leftover filament cost you.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loaded && spools.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BoxesIcon />
                    </EmptyMedia>
                    <EmptyTitle>No spools yet</EmptyTitle>
                    <EmptyDescription>Add the spools on your shelf to start tracking usage and cost.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spool</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Left value</TableHead>
                      <TableHead>Bought</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spools.map((s) => {
                      const pct = s.net_weight_g > 0 ? Math.round((s.remaining_g / s.net_weight_g) * 100) : 0
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="font-medium">{spoolName(s)}</div>
                            {(s.brand || s.colour) && s.label && (
                              <div className="text-xs text-muted-foreground">{[s.brand, s.colour].filter(Boolean).join(" · ")}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{s.material_name}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {grams(s.remaining_g)}
                            <span className="ml-1 text-xs text-muted-foreground">({pct}%)</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{grams(s.used_g)}</TableCell>
                          <TableCell className="text-right tabular-nums">{rands(s.cost_rands)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{randsPerKg(s.cost_per_g)}</TableCell>
                          <TableCell className="text-right tabular-nums">{rands(s.remaining_value_rands)}</TableCell>
                          <TableCell className="text-muted-foreground">{isoDate(s.purchased_on)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" aria-label="Delete spool" onClick={() => removeSpool(s)}>
                              <Trash2Icon />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prints">
          <Card>
            <CardHeader>
              <CardTitle>Prints</CardTitle>
              <CardDescription>Each print records the grams taken from each spool and the cost at that spool&apos;s price.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loaded && prints.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PrinterIcon />
                    </EmptyMedia>
                    <EmptyTitle>No prints logged</EmptyTitle>
                    <EmptyDescription>Log a print to take filament off a spool and record what it cost.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Print</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Filament</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prints.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{isoDate(p.printed_on)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs">
                            {p.usages.map((u) => (
                              <div key={u.id} className="flex items-center gap-1.5">
                                <span className="tabular-nums">{grams(u.grams)}</span>
                                <span>{u.material_name}</span>
                                <span className="text-muted-foreground">{u.label || [u.brand, u.colour].filter(Boolean).join(" ")}</span>
                                {u.role !== "part" && <Badge variant="outline">{u.role}</Badge>}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{grams(p.total_g)}</TableCell>
                        <TableCell className="text-right tabular-nums">{rands(p.total_cost_rands)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{minutes(p.print_time_min)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label="Delete print" onClick={() => removePrint(p)}>
                            <Trash2Icon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <CardTitle>By material</CardTitle>
              <CardDescription>Stock and usage rolled up per material.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loaded && (!summary || summary.by_material.length === 0) ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nothing to roll up yet</EmptyTitle>
                    <EmptyDescription>Add a spool and this table fills in.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Spools</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Left value</TableHead>
                      <TableHead className="text-right">Spent</TableHead>
                      <TableHead className="text-right">Printed</TableHead>
                      <TableHead className="text-right">Print cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.by_material.map((row) => (
                      <TableRow key={row.material_id}>
                        <TableCell className="font-medium">{row.material_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.spool_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{grams(row.remaining_g)}</TableCell>
                        <TableCell className="text-right tabular-nums">{rands(row.remaining_value_rands)}</TableCell>
                        <TableCell className="text-right tabular-nums">{rands(row.spent_rands)}</TableCell>
                        <TableCell className="text-right tabular-nums">{grams(row.printed_g)}</TableCell>
                        <TableCell className="text-right tabular-nums">{rands(row.print_cost_rands)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
