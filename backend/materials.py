"""Material reference endpoints: list, detail, stress-strain curve, support pairing.

Everything here is served straight from the JSON documents in data/ (see
filaments.py). No database involved.
"""

from flask import Blueprint, abort, jsonify

from curves import stress_strain_curve
from filaments import load_filaments

bp = Blueprint("materials", __name__, url_prefix="/api/materials")

# Bed windows this close (in °C) are treated as workable by picking a shared bed temperature.
BED_TOLERANCE_C = 10.0

_filaments = None


def filaments():
    global _filaments
    if _filaments is None:
        _filaments = load_filaments()
    return _filaments


def reload_filaments():
    """Re-read the data folder (used at startup and handy after editing a document)."""
    global _filaments
    _filaments = load_filaments()
    return _filaments


def materials_by_id():
    return {m["id"]: m for m in filaments()["materials"]}


def support_materials():
    return filaments()["support_materials"]


def _overlap(a, b):
    """Overlap of two [lo, hi] ranges. Returns (ok, gap_c). gap is how far apart they are if no overlap."""
    if a is None or b is None:
        return None, None
    lo = max(a[0], b[0])
    hi = min(a[1], b[1])
    if lo <= hi:
        return True, 0.0
    return False, round(lo - hi, 1)


def _fmt_range(r):
    if r is None:
        return "Off"
    if r[0] == r[1]:
        return f"{r[0]:g}"
    return f"{r[0]:g}-{r[1]:g}"


def support_options(material):
    """For one part material, evaluate every support material.

    Rating comes from the pairing matrix. On top of that, a dual-nozzle
    check: the two heads have independent nozzle temperatures, but they share
    the bed and the chamber, so those windows must overlap or the slicer
    (rightly) refuses the combination.
    """
    out = []
    for sup in support_materials():
        rating = material["support"].get(sup["name"]) or "No"
        if sup["name"] == material["name"]:
            rating = "No"

        # Bed: the two heads share one bed. Overlapping windows are fine. A small gap
        # (<= BED_TOLERANCE_C) is workable by running the bed at the shared edge.
        # A bigger gap is what makes the slicer refuse the combination.
        bed_overlaps, bed_gap = _overlap(material["bed_c"], sup["bed_c"])
        if bed_overlaps:
            bed_status = "overlap"
        elif bed_gap is not None and bed_gap <= BED_TOLERANCE_C:
            bed_status = "close"
        else:
            bed_status = "far"
        bed_ok = bed_status != "far"

        part_ch, sup_ch = material["chamber_c"], sup["chamber_c"]
        if sup.get("chamber_optional"):
            # Support tolerates a chamber up to sup_ch[1] but runs fine without one.
            if part_ch is None or sup_ch is None or part_ch[0] <= sup_ch[1]:
                chamber_ok, chamber_reason = True, None
            else:
                chamber_ok = False
                chamber_reason = (
                    f"{material['name']} needs a {_fmt_range(part_ch)}°C chamber; "
                    f"{sup['name']} only tolerates up to {sup_ch[1]:g}°C."
                )
        elif part_ch is None and sup_ch is None:
            chamber_ok, chamber_reason = True, None
        elif part_ch is None:
            chamber_ok = False
            chamber_reason = f"{sup['name']} wants a {_fmt_range(sup_ch)}°C chamber; {material['name']} needs it off."
        elif sup_ch is None:
            chamber_ok = False
            chamber_reason = f"{material['name']} needs a {_fmt_range(part_ch)}°C chamber; {sup['name']} would soften in it."
        else:
            chamber_ok, _ = _overlap(part_ch, sup_ch)
            chamber_reason = None if chamber_ok else "Chamber windows do not overlap."

        reasons = []
        if rating == "No":
            verdict = "no"
            reasons.append("Pairing matrix says No: bonds too well or process windows do not overlap.")
        else:
            if bed_status == "far":
                reasons.append(
                    f"Bed windows too far apart: {material['name']} {_fmt_range(material['bed_c'])}°C vs "
                    f"{sup['name']} {_fmt_range(sup['bed_c'])}°C ({bed_gap:g}°C gap)."
                )
            elif bed_status == "close":
                hotter = material if material["bed_c"][0] > sup["bed_c"][0] else sup
                reasons.append(
                    f"Bed windows are {bed_gap:g}°C apart ({material['name']} {_fmt_range(material['bed_c'])}°C, "
                    f"{sup['name']} {_fmt_range(sup['bed_c'])}°C). Run the bed at about {hotter['bed_c'][0]:g}°C "
                    f"and match both filament profiles to it."
                )
            if not chamber_ok and chamber_reason:
                reasons.append(chamber_reason)
            verdict = "ok" if (bed_ok and chamber_ok) else "temps"

        if sup["note"]:
            reasons.append(sup["note"])

        out.append({
            "id": sup["id"],
            "name": sup["name"],
            "is_part_material": sup["is_part_material"],
            "rating": rating,
            "verdict": verdict,  # ok | temps | no
            "nozzle_c": sup["nozzle_c"],
            "bed_c": sup["bed_c"],
            "chamber_c": sup["chamber_c"],
            "bed_status": bed_status,  # overlap | close | far
            "bed_ok": bed_ok,
            "chamber_ok": chamber_ok,
            "reasons": reasons,
        })

    order = {"ok": 0, "temps": 1, "no": 2}
    rank = {"Good": 0, "OK": 1, "No": 2}
    out.sort(key=lambda s: (order[s["verdict"]], rank.get(s["rating"], 3), s["name"]))
    return out


def _material_or_404(material_id):
    m = materials_by_id().get(material_id)
    if not m:
        abort(404, description=f"Unknown material '{material_id}'")
    return m


@bp.get("")
def list_materials():
    mats = sorted(filaments()["materials"], key=lambda m: (m.get("heat_rank") or 99, m["name"]))
    summary = [
        {
            "id": m["id"],
            "name": m["name"],
            "uts_mpa": m["uts_mpa"],
            "modulus_gpa": m["modulus_gpa"],
            "hdt_c": m["hdt_c"],
            "heated_chamber": m["heated_chamber"],
            "curve_class": m["curve_class"],
            "fixture_rating": m["fixture_rating"],
            "elongation_at_break_pct": m.get("elongation_at_break_pct"),
        }
        for m in mats
    ]
    # Global chart bounds: stress is the same for all, strain uses preset
    # steps so each material gets the tightest range that fits its data.
    all_uts = [m["uts_mpa"] for m in mats if m.get("uts_mpa")]
    chart_bounds = {
        "max_stress_mpa": max(all_uts) * 1.1 if all_uts else 250,
        "strain_presets": [25, 50, 100, 250, 500],
    }
    return jsonify({"materials": summary, "notes": filaments()["notes"], "chart_bounds": chart_bounds})


@bp.get("/<material_id>")
def material_detail(material_id):
    m = _material_or_404(material_id)
    return jsonify({
        "material": m,
        "curve": stress_strain_curve(m),
        "supports": support_options(m),
    })


@bp.get("/<material_id>/curve")
def material_curve(material_id):
    return jsonify(stress_strain_curve(_material_or_404(material_id)))


@bp.get("/<material_id>/supports")
def material_supports(material_id):
    return jsonify({"supports": support_options(_material_or_404(material_id))})
