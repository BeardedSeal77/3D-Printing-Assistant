"use client"

import * as React from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { api, type Spool, type UsageRole } from "@/lib/api"
import { grams, rands, today } from "@/lib/format"

type Props = {
  spools: Spool[]
  onCreated: () => void
}

type Line = { spool_id: string | null; role: UsageRole; grams: string }

const roleItems: { label: string; value: UsageRole }[] = [
  { label: "Part", value: "part" },
  { label: "Support", value: "support" },
  { label: "Purge / waste", value: "purge" },
]

function spoolLabel(s: Spool) {
  const name = s.label || [s.brand, s.colour].filter(Boolean).join(" ") || `Spool #${s.id}`
  return `${name} · ${s.material_name} · ${grams(s.remaining_g)} left`
}

export function LogPrintDialog({ spools, onCreated }: Props) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [name, setName] = React.useState("")
  const [printedOn, setPrintedOn] = React.useState(today())
  const [timeMin, setTimeMin] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [lines, setLines] = React.useState<Line[]>([{ spool_id: null, role: "part", grams: "" }])

  const usable = React.useMemo(() => spools.filter((s) => s.remaining_g > 0), [spools])
  const spoolItems = React.useMemo(
    () => [{ label: "Select a spool", value: null }, ...usable.map((s) => ({ label: spoolLabel(s), value: String(s.id) }))],
    [usable]
  )
  const byId = React.useMemo(() => new Map(spools.map((s) => [String(s.id), s])), [spools])

  const estimate = lines.reduce((sum, l) => {
    const s = l.spool_id ? byId.get(l.spool_id) : undefined
    const g = Number(l.grams)
    return s && g > 0 ? sum + g * s.cost_per_g : sum
  }, 0)
  const totalGrams = lines.reduce((sum, l) => sum + (Number(l.grams) > 0 ? Number(l.grams) : 0), 0)

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function reset() {
    setName("")
    setPrintedOn(today())
    setTimeMin("")
    setNotes("")
    setLines([{ spool_id: null, role: "part", grams: "" }])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const usages = lines
      .filter((l) => l.spool_id && Number(l.grams) > 0)
      .map((l) => ({ spool_id: Number(l.spool_id), role: l.role, grams: Number(l.grams) }))
    if (usages.length === 0) {
      toast.error("Add at least one spool with grams used")
      return
    }
    setBusy(true)
    try {
      await api.createPrint({
        name,
        printed_on: printedOn || undefined,
        print_time_min: timeMin === "" ? null : Number(timeMin),
        notes,
        usages,
      })
      toast.success("Print logged")
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log print")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Log print
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Log a print</DialogTitle>
            <DialogDescription>
              Grams come off the spools you pick. Cost is worked out from what each spool cost you.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="print-name">Print name</FieldLabel>
              <Input id="print-name" required placeholder="Bracket v2" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="print-date">Printed on</FieldLabel>
                <Input id="print-date" type="date" value={printedOn} onChange={(e) => setPrintedOn(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="print-time">Print time (minutes)</FieldLabel>
                <Input id="print-time" type="number" min={0} step={1} value={timeMin} onChange={(e) => setTimeMin(e.target.value)} />
              </Field>
            </div>

            <FieldSet>
              <FieldLegend>Filament used</FieldLegend>
              <FieldDescription>One line per spool. Use the slicer&apos;s estimate, or weigh the spool before and after.</FieldDescription>
              <div className="flex flex-col gap-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
                    <Field>
                      <FieldLabel htmlFor={`usage-spool-${i}`} className="sr-only">Spool</FieldLabel>
                      <Select items={spoolItems} value={line.spool_id} onValueChange={(v) => updateLine(i, { spool_id: v as string | null })}>
                        <SelectTrigger id={`usage-spool-${i}`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {spoolItems.map((item) => (
                              <SelectItem key={item.value ?? "placeholder"} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`usage-role-${i}`} className="sr-only">Role</FieldLabel>
                      <Select items={roleItems} value={line.role} onValueChange={(v) => updateLine(i, { role: v as UsageRole })}>
                        <SelectTrigger id={`usage-role-${i}`} className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {roleItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`usage-grams-${i}`} className="sr-only">Grams</FieldLabel>
                      <Input
                        id={`usage-grams-${i}`}
                        type="number"
                        min={0.1}
                        step={0.1}
                        placeholder="g"
                        className="w-24"
                        value={line.grams}
                        onChange={(e) => updateLine(i, { grams: e.target.value })}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((ls) => [...ls, { spool_id: null, role: ls.length === 0 ? "part" : "support", grams: "" }])}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add spool line
                </Button>
              </div>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="print-notes">Notes</FieldLabel>
              <Textarea id="print-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </FieldGroup>

          <DialogFooter className="sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {totalGrams > 0 ? (
                <>
                  {grams(totalGrams)} · about <span className="font-medium text-foreground">{rands(estimate)}</span>
                </>
              ) : (
                "Add grams to see the cost"
              )}
            </div>
            <div className="flex gap-2">
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button type="submit" disabled={busy}>
                {busy && <Spinner data-icon="inline-start" />}
                Save print
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
