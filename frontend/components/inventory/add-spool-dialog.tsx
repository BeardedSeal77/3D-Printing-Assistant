"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { api, type MaterialSummary } from "@/lib/api"
import { rands, today } from "@/lib/format"

type Props = {
  materials: MaterialSummary[]
  onCreated: () => void
}

const empty = {
  material_id: null as string | null,
  label: "",
  brand: "",
  colour: "",
  net_weight_g: "1000",
  remaining_g: "",
  cost_rands: "",
  purchased_on: today(),
  notes: "",
}

export function AddSpoolDialog({ materials, onCreated }: Props) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [form, setForm] = React.useState(empty)

  const items = React.useMemo(
    () => [
      { label: "Select a material", value: null },
      ...materials.map((m) => ({ label: m.name, value: m.id })),
    ],
    [materials]
  )

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const net = Number(form.net_weight_g)
  const cost = Number(form.cost_rands)
  const perKg = net > 0 && cost >= 0 && form.cost_rands !== "" ? (cost / net) * 1000 : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.material_id) {
      toast.error("Pick a material")
      return
    }
    setBusy(true)
    try {
      await api.createSpool({
        material_id: form.material_id,
        label: form.label,
        brand: form.brand,
        colour: form.colour,
        net_weight_g: Number(form.net_weight_g),
        remaining_g: form.remaining_g === "" ? undefined : Number(form.remaining_g),
        cost_rands: Number(form.cost_rands),
        purchased_on: form.purchased_on || null,
        notes: form.notes,
      })
      toast.success("Spool added")
      setForm({ ...empty, purchased_on: today() })
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add spool")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Add spool
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Add a spool</DialogTitle>
            <DialogDescription>Cost is what you paid for the whole spool. Weights are net filament, in grams.</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="spool-material">Material</FieldLabel>
              <Select items={items} value={form.material_id} onValueChange={(v) => setForm((f) => ({ ...f, material_id: v as string | null }))}>
                <SelectTrigger id="spool-material" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {items.map((item) => (
                      <SelectItem key={item.value ?? "placeholder"} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="spool-label">Label</FieldLabel>
              <Input id="spool-label" placeholder="PETG Black #1" value={form.label} onChange={set("label")} />
              <FieldDescription>A short name you will recognise when logging prints.</FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="spool-brand">Brand</FieldLabel>
                <Input id="spool-brand" placeholder="Bambu" value={form.brand} onChange={set("brand")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="spool-colour">Colour</FieldLabel>
                <Input id="spool-colour" placeholder="Black" value={form.colour} onChange={set("colour")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="spool-net">Net weight (g)</FieldLabel>
                <Input id="spool-net" type="number" min={1} step={1} required value={form.net_weight_g} onChange={set("net_weight_g")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="spool-remaining">Remaining (g)</FieldLabel>
                <Input id="spool-remaining" type="number" min={0} step={1} placeholder="Full spool" value={form.remaining_g} onChange={set("remaining_g")} />
                <FieldDescription>Leave blank for a new, full spool.</FieldDescription>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="spool-cost">Cost (R)</FieldLabel>
                <Input id="spool-cost" type="number" min={0} step={0.01} required placeholder="350.00" value={form.cost_rands} onChange={set("cost_rands")} />
                {perKg !== null && <FieldDescription>{rands(perKg)} per kg</FieldDescription>}
              </Field>
              <Field>
                <FieldLabel htmlFor="spool-date">Purchased on</FieldLabel>
                <Input id="spool-date" type="date" value={form.purchased_on} onChange={set("purchased_on")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="spool-notes">Notes</FieldLabel>
              <Textarea id="spool-notes" rows={2} value={form.notes} onChange={set("notes")} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner data-icon="inline-start" />}
              Save spool
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
