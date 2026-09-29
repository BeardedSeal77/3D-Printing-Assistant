"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SupportOption } from "@/lib/api"
import { tempRange } from "@/lib/format"

function RatingBadge({ rating }: { rating: SupportOption["rating"] }) {
  if (rating === "Good") return <Badge>Good</Badge>
  if (rating === "OK") return <Badge variant="secondary">OK</Badge>
  return <Badge variant="outline">No</Badge>
}

function VerdictBadge({ verdict }: { verdict: SupportOption["verdict"] }) {
  if (verdict === "ok") return <Badge>Prints together</Badge>
  if (verdict === "temps") return <Badge variant="destructive">Temp clash</Badge>
  return <Badge variant="outline">Don&apos;t pair</Badge>
}

export function SupportTable({ supports, partName }: { supports: SupportOption[]; partName: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Support material</TableHead>
          <TableHead>Pairing</TableHead>
          <TableHead>Dual-nozzle check</TableHead>
          <TableHead className="text-right">Nozzle</TableHead>
          <TableHead className="text-right">Bed</TableHead>
          <TableHead className="text-right">Chamber</TableHead>
          <TableHead className="min-w-64">Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {supports.map((s) => (
          <TableRow key={s.id} className={s.verdict === "no" ? "text-muted-foreground" : undefined}>
            <TableCell className="font-medium">
              {s.name}
              {s.name === partName && (
                <span className="ml-1.5 text-xs text-muted-foreground">(same material)</span>
              )}
            </TableCell>
            <TableCell>
              <RatingBadge rating={s.rating} />
            </TableCell>
            <TableCell>
              <VerdictBadge verdict={s.verdict} />
            </TableCell>
            <TableCell className="text-right font-mono text-xs">{tempRange(s.nozzle_c)}</TableCell>
            <TableCell className="text-right font-mono text-xs">{tempRange(s.bed_c)}</TableCell>
            <TableCell className="text-right font-mono text-xs">{tempRange(s.chamber_c)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {s.reasons.length ? (
                <ul className="flex flex-col gap-1">
                  {s.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                "Bed and chamber windows overlap."
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
