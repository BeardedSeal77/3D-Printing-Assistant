"""Flask API for the 3D printing dashboard.

    python app.py            (from backend/, with the venv active)

No database. Materials are read from the JSON documents in data/materials/,
and inventory (spools, prints) is kept in data/inventory.json.

    GET  /api/health
    GET  /api/materials                      list of materials
    GET  /api/materials/<id>                 material + stress-strain curve + support options
    GET  /api/materials/<id>/curve
    GET  /api/materials/<id>/supports
    GET  /api/spools   POST /api/spools   PATCH/DELETE /api/spools/<id>
    GET  /api/prints   POST /api/prints   DELETE /api/prints/<id>
    GET  /api/summary                        stock and usage totals in grams and rands
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, jsonify  # noqa: E402
from flask_cors import CORS  # noqa: E402
from werkzeug.exceptions import HTTPException  # noqa: E402

import inventory  # noqa: E402
import materials  # noqa: E402
from store import STORE_FILE  # noqa: E402

FLASK_PORT = int(os.environ.get("FLASK_PORT", "5328"))


def create_app():
    app = Flask(__name__)
    CORS(app)
    app.json.ensure_ascii = False

    app.register_blueprint(materials.bp)
    app.register_blueprint(inventory.bp)

    @app.get("/api/health")
    def health():
        data = materials.filaments()
        return jsonify({
            "status": "ok",
            "materials": len(data["materials"]),
            "inventory_file": str(STORE_FILE),
            "inventory_exists": STORE_FILE.exists(),
        })

    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        return jsonify({"error": err.description, "status": err.code}), err.code

    return app


app = create_app()

if __name__ == "__main__":
    data = materials.reload_filaments()
    print(f"Loaded {len(data['materials'])} materials from data/materials/")
    print(f"Inventory file: {STORE_FILE}")
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=True)
