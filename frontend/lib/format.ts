import type { Range } from "@/lib/api"

const randsFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const gramsFormatter = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function rands(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return randsFormatter.format(value)
}

export function grams(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${gramsFormatter.format(value)} g`
}

export function randsPerKg(costPerGram: number | null | undefined) {
  if (costPerGram === null || costPerGram === undefined) return "—"
  return `${randsFormatter.format(costPerGram * 1000)}/kg`
}

export function num(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${numberFormatter.format(value)}${unit}`
}

export function tempRange(range: Range, offLabel = "Off") {
  if (!range) return offLabel
  const [lo, hi] = range
  return lo === hi ? `${lo}°C` : `${lo}–${hi}°C`
}

export function minutes(value: number | null | undefined) {
  if (!value) return "—"
  const h = Math.floor(value / 60)
  const m = value % 60
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`
}

export function isoDate(value: string | null | undefined) {
  if (!value) return "—"
  return value.slice(0, 10)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}
