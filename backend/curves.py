"""Representative stress-strain curves.

The sheets give tensile strength (UTS), modulus (E) and a failure description
but no measured curve. This builds a plausible curve from those numbers plus a
typical elongation at break, so the chart shows the *shape* of each material's
behaviour (brittle snap vs ductile yield vs rubbery stretch). It is illustrative,
not test data.
"""


def _linspace(a, b, n):
    if n <= 1:
        return [a]
    step = (b - a) / (n - 1)
    return [a + i * step for i in range(n)]


def _round_point(strain_pct, stress_mpa):
    return {"strain_pct": round(strain_pct, 3), "stress_mpa": round(stress_mpa, 2)}


def stress_strain_curve(material):
    uts = material.get("uts_mpa")
    e_gpa = material.get("modulus_gpa")
    eb = material.get("elongation_at_break_pct")
    cls = material.get("curve_class") or "unknown"

    if not uts or not e_gpa or not eb:
        return {"points": [], "markers": {}, "model": "unavailable", "curve_class": cls}

    e_mpa = e_gpa * 1000.0  # stress per unit strain (strain as a fraction)
    points = []
    markers = {}

    if cls == "elastomer":
        # Rubbery: soft initial slope, long plateau, then strain hardening up to UTS at break.
        # A simple cubic blend in normalised strain gives that S shape.
        c1, c2 = 0.7, 0.3
        for t in _linspace(0.0, 1.0, 80):
            stress = uts * (c1 * t + c2 * t**3)
            points.append(_round_point(t * eb, stress))
        markers = {
            "break": _round_point(eb, uts),
            "note": "Elastomer: no distinct yield point. Curve is a smooth stretch to break.",
        }
    else:
        if cls == "brittle":
            yield_frac, uts_pos, tail_frac = 0.85, 1.0, None
        elif cls == "semi-brittle":
            yield_frac, uts_pos, tail_frac = 0.80, 0.9, 0.95
        else:  # ductile
            yield_frac, uts_pos, tail_frac = 0.70, 0.35, 0.85

        sy = uts * yield_frac                  # proportional limit / yield stress
        ey = (sy / e_mpa) * 100.0              # strain % at yield (linear region)
        if ey >= eb * 0.9:                     # keep the model sane for very stiff data
            ey = eb * 0.5
            sy = e_mpa * ey / 100.0

        # 1) Linear elastic region.
        for s in _linspace(0.0, ey, 20):
            points.append(_round_point(s, e_mpa * s / 100.0))

        # 2) Yield -> UTS: concave hardening that flattens out at UTS.
        e_uts = ey + (eb - ey) * uts_pos
        for t in _linspace(0.0, 1.0, 35)[1:]:
            stress = sy + (uts - sy) * (1.0 - (1.0 - t) ** 2)
            points.append(_round_point(ey + (e_uts - ey) * t, stress))

        # 3) Necking / drawing down to break (ductile & semi-brittle only).
        if tail_frac is not None and e_uts < eb:
            s_break = uts * tail_frac
            for t in _linspace(0.0, 1.0, 25)[1:]:
                stress = uts - (uts - s_break) * t
                points.append(_round_point(e_uts + (eb - e_uts) * t, stress))
            break_point = _round_point(eb, s_break)
        else:
            break_point = _round_point(e_uts, uts)

        markers = {
            "yield": _round_point(ey, sy),
            "uts": _round_point(e_uts, uts),
            "break": break_point,
        }

    return {
        "points": points,
        "markers": markers,
        "model": "illustrative",
        "curve_class": cls,
        "inputs": {
            "uts_mpa": uts,
            "modulus_gpa": e_gpa,
            "elongation_at_break_pct": eb,
        },
    }
