"""Inventory: spools (stock) and prints (usage). Everything in grams and rands.

Backed by data/inventory.json through store.py. Response shapes are the same
as the earlier Postgres version so the frontend does not care which is used.
"""

import math
from datetime import date

from flask import Blueprint, abort, jsonify, request

from materials import materials_by_id
from store import load, next_id, now_iso, today_iso, transaction

bp = Blueprint("inventory", __name__, url_prefix="/api")

ROLES = ("part", "support", "purge")


# ---------- input helpers ----------

def _body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Expected a JSON object body")
    return data


def _num(data, key, *, required=False, default=None, minimum=None, exclusive_min=False, decimals=2):
    raw = data.get(key, None)
    if raw is None or raw == "":
        if required:
            abort(400, description=f"'{key}' is required")
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        abort(400, description=f"'{key}' must be a number")
    if not math.isfinite(value):
        abort(400, description=f"'{key}' must be a finite number")
    if minimum is not None:
        if exclusive_min and value <= minimum:
            abort(400, description=f"'{key}' must be greater than {minimum:g}")
        if not exclusive_min and value < minimum:
            abort(400, description=f"'{key}' must be at least {minimum:g}")
    return round(value, decimals)


def _int(data, key, *, default=None):
    raw = data.get(key, None)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        abort(400, description=f"'{key}' must be an integer")


def _date(data, key, *, default=None):
    raw = data.get(key, None)
    if raw is None or raw == "":
        return default
    try:
        return date.fromisoformat(str(raw)).isoformat()
    except ValueError:
        abort(400, description=f"'{key}' must be an ISO date (YYYY-MM-DD)")


def _str(data, key, *, default="", required=False):
    raw = data.get(key, default)
    if raw is None:
        raw = default
    raw = str(raw).strip()
    if required and not raw:
        abort(400, description=f"'{key}' is required")
    return raw


def _require_material(material_id):
    if material_id not in materials_by_id():
        abort(400, description=f"Unknown material_id '{material_id}'")


# ---------- views (add computed fields) ----------

def _spool_view(s):
    mats = materials_by_id()
    net = s["net_weight_g"]
    cost_per_g = s["cost_rands"] / net if net else 0.0
    return {
        **s,
        "material_name": mats.get(s["material_id"], {}).get("name", s["material_id"]),
        "used_g": round(net - s["remaining_g"], 1),
        "cost_per_g": round(cost_per_g, 4),
        "remaining_value_rands": round(s["remaining_g"] * cost_per_g, 2),
    }


def _print_view(p, spools_by_id):
    mats = materials_by_id()
    usages = []
    for u in p["usages"]:
        s = spools_by_id.get(u["spool_id"], {})
        usages.append({
            **u,
            "print_id": p["id"],
            "label": s.get("label", ""),
            "brand": s.get("brand", ""),
            "colour": s.get("colour", ""),
            "material_name": mats.get(s.get("material_id"), {}).get("name", s.get("material_id", "?")),
        })
    return {
        **p,
        "usages": usages,
        "total_g": round(sum(u["grams"] for u in usages), 1),
        "total_cost_rands": round(sum(u["cost_rands"] for u in usages), 2),
    }


def _find(items, item_id, what):
    for item in items:
        if item["id"] == item_id:
            return item
    abort(404, description=f"{what} {item_id} not found")


# ---------- spools ----------

@bp.get("/spools")
def list_spools():
    data = load()
    spools = sorted(data["spools"], key=lambda s: (s["created_at"], s["id"]), reverse=True)
    return jsonify({"spools": [_spool_view(s) for s in spools]})


@bp.post("/spools")
def create_spool():
    body = _body()
    material_id = _str(body, "material_id", required=True)
    _require_material(material_id)
    net = _num(body, "net_weight_g", required=True, minimum=0, exclusive_min=True, decimals=1)
    remaining = _num(body, "remaining_g", default=net, minimum=0, decimals=1)
    if remaining > net:
        abort(400, description="'remaining_g' cannot exceed 'net_weight_g'")
    cost = _num(body, "cost_rands", required=True, minimum=0)

    with transaction() as data:
        spool = {
            "id": next_id(data, "next_spool_id"),
            "material_id": material_id,
            "brand": _str(body, "brand"),
            "colour": _str(body, "colour"),
            "label": _str(body, "label"),
            "net_weight_g": net,
            "remaining_g": remaining,
            "cost_rands": cost,
            "purchased_on": _date(body, "purchased_on"),
            "notes": _str(body, "notes"),
            "created_at": now_iso(),
        }
        data["spools"].append(spool)
    return jsonify({"spool": _spool_view(spool)}), 201


@bp.patch("/spools/<int:spool_id>")
def update_spool(spool_id):
    body = _body()
    with transaction() as data:
        spool = _find(data["spools"], spool_id, "Spool")

        material_id = _str(body, "material_id", default=spool["material_id"])
        if material_id != spool["material_id"]:
            _require_material(material_id)

        net = _num(body, "net_weight_g", default=spool["net_weight_g"], minimum=0, exclusive_min=True, decimals=1)
        remaining = _num(body, "remaining_g", default=spool["remaining_g"], minimum=0, decimals=1)
        if remaining > net:
            abort(400, description="'remaining_g' cannot exceed 'net_weight_g'")

        spool.update({
            "material_id": material_id,
            "brand": _str(body, "brand", default=spool["brand"]),
            "colour": _str(body, "colour", default=spool["colour"]),
            "label": _str(body, "label", default=spool["label"]),
            "net_weight_g": net,
            "remaining_g": remaining,
            "cost_rands": _num(body, "cost_rands", default=spool["cost_rands"], minimum=0),
            "purchased_on": _date(body, "purchased_on", default=spool["purchased_on"]),
            "notes": _str(body, "notes", default=spool["notes"]),
        })
    return jsonify({"spool": _spool_view(spool)})


@bp.delete("/spools/<int:spool_id>")
def delete_spool(spool_id):
    with transaction() as data:
        _find(data["spools"], spool_id, "Spool")
        if any(u["spool_id"] == spool_id for p in data["prints"] for u in p["usages"]):
            abort(409, description="Spool has prints logged against it. Delete those prints first.")
        data["spools"] = [s for s in data["spools"] if s["id"] != spool_id]
    return "", 204


# ---------- prints ----------

@bp.get("/prints")
def list_prints():
    data = load()
    spools_by_id = {s["id"]: s for s in data["spools"]}
    prints = sorted(data["prints"], key=lambda p: (p["printed_on"], p["id"]), reverse=True)
    return jsonify({"prints": [_print_view(p, spools_by_id) for p in prints]})


@bp.post("/prints")
def create_print():
    body = _body()
    name = _str(body, "name", required=True)
    usages_in = body.get("usages")
    if not isinstance(usages_in, list) or not usages_in:
        abort(400, description="'usages' must be a non-empty list of {spool_id, grams, role}")

    parsed = []
    for i, u in enumerate(usages_in):
        if not isinstance(u, dict):
            abort(400, description=f"usages[{i}] must be an object")
        spool_id = _int(u, "spool_id")
        if spool_id is None:
            abort(400, description=f"usages[{i}].spool_id is required")
        grams = _num(u, "grams", required=True, minimum=0, exclusive_min=True, decimals=1)
        role = _str(u, "role", default="part").lower()
        if role not in ROLES:
            abort(400, description=f"usages[{i}].role must be one of {', '.join(ROLES)}")
        parsed.append((spool_id, grams, role))

    with transaction() as data:
        spools_by_id = {s["id"]: s for s in data["spools"]}

        # Check stock for every spool before touching anything.
        needed = {}
        for spool_id, grams, _ in parsed:
            needed[spool_id] = needed.get(spool_id, 0.0) + grams
        for spool_id, total in needed.items():
            s = spools_by_id.get(spool_id)
            if not s:
                abort(400, description=f"Spool {spool_id} not found")
            if s["remaining_g"] + 1e-9 < total:
                abort(
                    400,
                    description=(
                        f"Spool {spool_id} ({s['label'] or 'unlabelled'}) only has "
                        f"{s['remaining_g']:g} g left, print needs {total:g} g"
                    ),
                )

        usages = []
        for spool_id, grams, role in parsed:
            s = spools_by_id[spool_id]
            cost_per_g = s["cost_rands"] / s["net_weight_g"]
            usages.append({
                "id": next_id(data, "next_usage_id"),
                "spool_id": spool_id,
                "role": role,
                "grams": grams,
                "cost_rands": round(grams * cost_per_g, 2),  # snapshot at the spool's price
            })
        for spool_id, total in needed.items():
            s = spools_by_id[spool_id]
            s["remaining_g"] = round(max(0.0, s["remaining_g"] - total), 1)

        p = {
            "id": next_id(data, "next_print_id"),
            "name": name,
            "printed_on": _date(body, "printed_on", default=today_iso()),
            "print_time_min": _int(body, "print_time_min"),
            "notes": _str(body, "notes"),
            "created_at": now_iso(),
            "usages": usages,
        }
        data["prints"].append(p)
        view = _print_view(p, spools_by_id)
    return jsonify({"print": view}), 201


@bp.delete("/prints/<int:print_id>")
def delete_print(print_id):
    """Deleting a print puts its grams back on the spools."""
    with transaction() as data:
        p = _find(data["prints"], print_id, "Print")
        spools_by_id = {s["id"]: s for s in data["spools"]}
        for u in p["usages"]:
            s = spools_by_id.get(u["spool_id"])
            if s:
                s["remaining_g"] = round(min(s["net_weight_g"], s["remaining_g"] + u["grams"]), 1)
        data["prints"] = [x for x in data["prints"] if x["id"] != print_id]
    return "", 204


# ---------- summary ----------

@bp.get("/summary")
def summary():
    data = load()
    mats = materials_by_id()
    spools = data["spools"]
    spools_by_id = {s["id"]: s for s in spools}

    def value_left(s):
        return s["remaining_g"] * s["cost_rands"] / s["net_weight_g"] if s["net_weight_g"] else 0.0

    stock = {
        "spool_count": len(spools),
        "remaining_g": round(sum(s["remaining_g"] for s in spools), 1),
        "purchased_g": round(sum(s["net_weight_g"] for s in spools), 1),
        "spent_rands": round(sum(s["cost_rands"] for s in spools), 2),
        "remaining_value_rands": round(sum(value_left(s) for s in spools), 2),
    }

    all_usages = [u for p in data["prints"] for u in p["usages"]]
    usage = {
        "print_count": len(data["prints"]),
        "printed_g": round(sum(u["grams"] for u in all_usages), 1),
        "print_cost_rands": round(sum(u["cost_rands"] for u in all_usages), 2),
    }

    by_material = {}
    for s in spools:
        row = by_material.setdefault(s["material_id"], {
            "material_id": s["material_id"],
            "material_name": mats.get(s["material_id"], {}).get("name", s["material_id"]),
            "spool_count": 0,
            "remaining_g": 0.0,
            "spent_rands": 0.0,
            "remaining_value_rands": 0.0,
            "printed_g": 0.0,
            "print_cost_rands": 0.0,
        })
        row["spool_count"] += 1
        row["remaining_g"] += s["remaining_g"]
        row["spent_rands"] += s["cost_rands"]
        row["remaining_value_rands"] += value_left(s)
    for u in all_usages:
        s = spools_by_id.get(u["spool_id"])
        if s and s["material_id"] in by_material:
            by_material[s["material_id"]]["printed_g"] += u["grams"]
            by_material[s["material_id"]]["print_cost_rands"] += u["cost_rands"]
    rows = sorted(by_material.values(), key=lambda r: r["remaining_g"], reverse=True)
    for r in rows:
        for k in ("remaining_g", "printed_g"):
            r[k] = round(r[k], 1)
        for k in ("spent_rands", "remaining_value_rands", "print_cost_rands"):
            r[k] = round(r[k], 2)

    return jsonify({"stock": stock, "usage": usage, "by_material": rows})
