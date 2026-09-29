"""File-backed inventory store.

Spools and prints live in data/inventory.json. Every write goes through
transaction(), which takes a process-wide lock, loads the file, hands the
dict to the caller, and writes it back atomically (temp file + replace) only
if the caller finishes without raising. That keeps a print and the spool
deductions it causes in one save.
"""

import json
import os
import tempfile
import threading
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORE_FILE = ROOT / "data" / "inventory.json"

_lock = threading.RLock()


def _default():
    return {
        "next_spool_id": 1,
        "next_print_id": 1,
        "next_usage_id": 1,
        "spools": [],
        "prints": [],
    }


def load():
    with _lock:
        if not STORE_FILE.exists():
            return _default()
        data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
        base = _default()
        base.update(data)
        return base


def save(data):
    with _lock:
        STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".inventory-", suffix=".json", dir=STORE_FILE.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=2, ensure_ascii=False)
                fh.write("\n")
            os.replace(tmp, STORE_FILE)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)


@contextmanager
def transaction():
    """Lock, load, yield the data dict, save on success. Nothing is written if the block raises."""
    with _lock:
        data = load()
        yield data
        save(data)


def next_id(data, key):
    value = data[key]
    data[key] = value + 1
    return value


def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def today_iso():
    return date.today().isoformat()
