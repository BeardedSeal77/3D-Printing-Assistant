"""Load the filament reference data from data/.

Layout (one document per material, edit them directly):

    data/materials/<id>.json       one material each, e.g. petg.json
    data/support-materials.json    the support matrix columns, in order
    data/notes.json                footnotes shown on the materials page

Each material document carries its own "support" map (support material name
-> Good / OK / No), so adding a material means adding one file. A new support
column means adding it to support-materials.json and to each material's map.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MATERIALS_DIR = DATA / "materials"
SUPPORT_FILE = DATA / "support-materials.json"
NOTES_FILE = DATA / "notes.json"

REQUIRED_FIELDS = ("id", "name", "nozzle_c", "bed_c", "chamber_c", "support")


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_materials():
    materials = []
    for path in sorted(MATERIALS_DIR.glob("*.json")):
        doc = _read(path)
        missing = [f for f in REQUIRED_FIELDS if f not in doc]
        if missing:
            raise ValueError(f"{path.name} is missing fields: {', '.join(missing)}")
        if doc["id"] != path.stem:
            raise ValueError(f"{path.name}: 'id' is '{doc['id']}' but the file name says '{path.stem}'")
        materials.append(doc)
    if not materials:
        raise FileNotFoundError(f"No material documents found in {MATERIALS_DIR}")
    _add_derived_fields(materials)
    return materials


def _competition_rank(materials, key, out_key):
    """Rank by key descending, ties share a rank and the next rank is skipped (1, 2, 2, 4).
    Materials without a value get None."""
    ranked = sorted((m for m in materials if m.get(key) is not None), key=lambda m: -m[key])
    prev_value, prev_rank = None, 0
    for i, m in enumerate(ranked, start=1):
        if m[key] != prev_value:
            prev_rank = i
            prev_value = m[key]
        m[out_key] = prev_rank
    for m in materials:
        m.setdefault(out_key, None)


def _add_derived_fields(materials):
    """Fields that follow from the numbers, computed here so documents never go stale:
    specific_stiffness = E (MPa) / UTS (MPa), plus stiffness and heat ranks across all materials."""
    for m in materials:
        e, uts = m.get("modulus_gpa"), m.get("uts_mpa")
        m["specific_stiffness"] = round(e * 1000.0 / uts, 1) if e and uts else None
    _competition_rank(materials, "specific_stiffness", "stiffness_rank")
    _competition_rank(materials, "hdt_c", "heat_rank")


def load_support_materials(materials):
    by_id = {m["id"]: m for m in materials}
    out = []
    for entry in _read(SUPPORT_FILE)["support_materials"]:
        if "material_id" in entry:
            m = by_id.get(entry["material_id"])
            if not m:
                raise ValueError(f"support-materials.json refers to unknown material '{entry['material_id']}'")
            out.append({
                "id": m["id"],
                "name": entry.get("name", m["name"]),
                "is_part_material": True,
                "nozzle_c": m["nozzle_c"],
                "bed_c": m["bed_c"],
                "chamber_c": m["chamber_c"],
                "chamber_optional": False,
                "note": entry.get("note"),
            })
        else:
            out.append({
                "id": entry["id"],
                "name": entry["name"],
                "is_part_material": False,
                "nozzle_c": entry.get("nozzle_c"),
                "bed_c": entry.get("bed_c"),
                "chamber_c": entry.get("chamber_c"),
                # True = tolerates a chamber up to chamber_c[1] but does not need one.
                "chamber_optional": bool(entry.get("chamber_optional", False)),
                "note": entry.get("note"),
            })
    return out


def load_notes():
    return _read(NOTES_FILE).get("notes", []) if NOTES_FILE.exists() else []


def load_filaments():
    """Assemble everything the API needs: materials, support columns, notes."""
    materials = load_materials()
    return {
        "materials": materials,
        "support_materials": load_support_materials(materials),
        "notes": load_notes(),
    }


if __name__ == "__main__":
    data = load_filaments()
    print(f"{len(data['materials'])} materials, {len(data['support_materials'])} support materials, {len(data['notes'])} notes")
    for m in data["materials"]:
        unknown = set(m["support"]) - {s["name"] for s in data["support_materials"]}
        if unknown:
            print(f"  warning: {m['id']} has support entries not in support-materials.json: {sorted(unknown)}")
