// Typed client for the Flask API. Requests go to /api/* and Next.js proxies them
// to the backend (see next.config.ts), so no CORS and one origin in the browser.

export type Range = [number, number] | null

export type MaterialSummary = {
  id: string
  name: string
  uts_mpa: number | null
  modulus_gpa: number | null
  hdt_c: number | null
  heated_chamber: boolean
  curve_class: string
  fixture_rating: string
  elongation_at_break_pct: number | null
}

export type ChartBounds = {
  max_stress_mpa: number
  strain_presets: number[]
}

export type Material = MaterialSummary & {
  uts_label: string
  modulus_label: string
  hdt_label: string | null
  shrinkage_pct: number | null
  specific_stiffness: number | null
  stiffness_rank: number | null
  heat_rank: number | null
  fails_by: string
  creep_rt: string | null
  watch_for: string
  breakaway_support: string | null
  soluble_support: string | null
  do_not_use_as_support: string | null
  nozzle_c: Range
  bed_c: Range
  chamber_c: Range
  hardened_nozzle: boolean
  must_dry: string
  ams2_pro: string
  elongation_at_break_pct: number | null
  support: Record<string, "Good" | "OK" | "No" | null>
  bambu?: {
    name: string
    toughness_kj_m2: number | null
    strength_mpa: number | null
    stiffness_mpa: number | null
    layer_adhesion_mpa: number | null
    hdt_c: number | null
    water_absorption_pct: number | null
    dry_before_use: string | null
    dry_required: boolean
    drying_condition: string | null
    ams_compatible: boolean
    nozzle_temp_c: Range
    bed_temp_c: Range
    build_plate: { plate: string; temp_c: Range }[] | null
    nozzle_sizes: string[] | null
    nozzle_material: string | null
    print_speed_mm_s: number | null
    part_cooling_fan: string | null
    enclosure_required: boolean
    seal_with_desiccant: boolean
    annealing: { temp_c: Range; hours: [number, number] | null } | null
    adhesion_methods: string | null
  }
}

export type CurvePoint = { strain_pct: number; stress_mpa: number }

export type Curve = {
  points: CurvePoint[]
  markers: { yield?: CurvePoint; uts?: CurvePoint; break?: CurvePoint; note?: string }
  model: "illustrative" | "unavailable"
  curve_class: string
  inputs?: { uts_mpa: number; modulus_gpa: number; elongation_at_break_pct: number }
}

export type SupportOption = {
  id: string
  name: string
  is_part_material: boolean
  rating: "Good" | "OK" | "No"
  verdict: "ok" | "temps" | "no"
  nozzle_c: Range
  bed_c: Range
  chamber_c: Range
  chamber_optional?: boolean
  bed_status: "overlap" | "close" | "far"
  bed_ok: boolean
  chamber_ok: boolean
  reasons: string[]
}

export type MaterialDetail = {
  material: Material
  curve: Curve
  supports: SupportOption[]
}

export type Spool = {
  id: number
  material_id: string
  material_name: string
  brand: string
  colour: string
  label: string
  net_weight_g: number
  remaining_g: number
  used_g: number
  cost_rands: number
  cost_per_g: number
  remaining_value_rands: number
  purchased_on: string | null
  notes: string
  created_at: string
}

export type SpoolInput = {
  material_id: string
  brand?: string
  colour?: string
  label?: string
  net_weight_g: number
  remaining_g?: number
  cost_rands: number
  purchased_on?: string | null
  notes?: string
}

export type UsageRole = "part" | "support" | "purge"

export type Usage = {
  id: number
  print_id: number
  spool_id: number
  role: UsageRole
  grams: number
  cost_rands: number
  label: string
  brand: string
  colour: string
  material_name: string
}

export type Print = {
  id: number
  name: string
  printed_on: string
  print_time_min: number | null
  notes: string
  created_at: string
  total_g: number
  total_cost_rands: number
  usages: Usage[]
}

export type PrintInput = {
  name: string
  printed_on?: string
  print_time_min?: number | null
  notes?: string
  usages: { spool_id: number; role: UsageRole; grams: number }[]
}

export type Summary = {
  stock: {
    spool_count: number
    remaining_g: number
    purchased_g: number
    spent_rands: number
    remaining_value_rands: number
  }
  usage: {
    print_count: number
    printed_g: number
    print_cost_rands: number
  }
  by_material: {
    material_id: string
    material_name: string
    spool_count: number
    remaining_g: number
    spent_rands: number
    remaining_value_rands: number
    printed_g: number
    print_cost_rands: number
  }[]
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `${res.status} ${res.statusText}`
    throw new ApiError(message, res.status)
  }
  return body as T
}

export const api = {
  materials: () => request<{ materials: MaterialSummary[]; notes: string[]; chart_bounds: ChartBounds }>("/materials"),
  material: (id: string) => request<MaterialDetail>(`/materials/${encodeURIComponent(id)}`),

  spools: () => request<{ spools: Spool[] }>("/spools"),
  createSpool: (input: SpoolInput) =>
    request<{ spool: Spool }>("/spools", { method: "POST", body: JSON.stringify(input) }),
  updateSpool: (id: number, input: Partial<SpoolInput>) =>
    request<{ spool: Spool }>(`/spools/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteSpool: (id: number) => request<void>(`/spools/${id}`, { method: "DELETE" }),

  prints: () => request<{ prints: Print[] }>("/prints"),
  createPrint: (input: PrintInput) =>
    request<{ print: Print }>("/prints", { method: "POST", body: JSON.stringify(input) }),
  deletePrint: (id: number) => request<void>(`/prints/${id}`, { method: "DELETE" }),

  summary: () => request<Summary>("/summary"),
}
