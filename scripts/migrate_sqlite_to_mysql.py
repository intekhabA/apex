#!/usr/bin/env python3
"""
CLI entry point to migrate SQLite to MySQL for DiagnoLab.
Usage:
    python scripts/migrate_sqlite_to_mysql.py
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.migrate_sqlite_to_mysql import main

if __name__ == "__main__":
    main()
