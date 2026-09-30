"""
DiagnoLab - SQLite to MySQL Migration Utility
Migrates all relational healthcare schema, multi-tenant records, audit logs,
and diagnostic data from SQLite (e.g. diagnolab.db) into MySQL.
"""

import os
import sys
import argparse
import json
from enum import Enum
from pathlib import Path
from typing import List, Dict, Any

from sqlalchemy import create_engine, select, text, Table
from sqlalchemy.orm import Session

# Add backend directory to sys.path if not present
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.models import Base

# Optimal topological order for table migration
TABLE_MIGRATION_ORDER = [
    "laboratories",
    "laboratory_settings",
    "users",
    "test_categories",
    "tests",
    "test_parameters",
    "test_reference_ranges",
    "test_packages",
    "test_package_items",
    "lab_test_prices",
    "patients",
    "bookings",
    "booking_items",
    "samples",
    "sample_tracking_events",
    "reports",
    "report_versions",
    "report_attachments",
    "test_result_values",
    "invoices",
    "payments",
    "notification_logs",
    "audit_logs",
]


def find_sqlite_file(preferred_path: str = None) -> str:
    """Resolve the location of the SQLite database file."""
    candidates = []
    if preferred_path:
        candidates.append(Path(preferred_path))
    candidates.extend([
        BACKEND_DIR / "diagnolab.db",
        Path("backend/diagnolab.db"),
        Path("diagnolab.db"),
    ])

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return str(candidate.resolve())

    if preferred_path:
        return preferred_path
    return str((BACKEND_DIR / "diagnolab.db").resolve())


def get_mysql_sync_url(override_url: str = None) -> str:
    """Resolve the synchronous MySQL connection URL."""
    if override_url:
        url = override_url
    elif settings.SYNC_DATABASE_URL and "mysql" in settings.SYNC_DATABASE_URL:
        url = settings.SYNC_DATABASE_URL
    elif settings.DATABASE_URL and "mysql" in settings.DATABASE_URL:
        url = settings.DATABASE_URL.replace("mysql+aiomysql://", "mysql+pymysql://")
    else:
        url = f"mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}"

    # Ensure pymysql driver is specified for synchronous migration
    if url.startswith("mysql://"):
        url = url.replace("mysql://", "mysql+pymysql://", 1)
    elif url.startswith("mysql+aiomysql://"):
        url = url.replace("mysql+aiomysql://", "mysql+pymysql://", 1)

    return url


def sanitize_row_values(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Convert python enums or incompatible representations for MySQL insertion."""
    clean = {}
    for k, v in row_dict.items():
        if isinstance(v, Enum):
            clean[k] = v.value
        elif isinstance(v, (dict, list)):
            # MySQL JSON type accepts dict/list or JSON string via SQLAlchemy
            clean[k] = v
        else:
            clean[k] = v
    return clean


def migrate_sqlite_to_mysql(
    sqlite_path: str,
    mysql_url: str,
    create_tables: bool = True,
    truncate_target: bool = False,
    batch_size: int = 500,
) -> bool:
    """Execute complete migration from SQLite to MySQL."""
    print("=" * 70)
    print("🚀 DiagnoLab: SQLite -> MySQL Migration Engine")
    print("=" * 70)

    # 1. Verify SQLite file
    sqlite_file = Path(sqlite_path)
    if not sqlite_file.exists():
        print(f"❌ SQLite database file not found at: {sqlite_path}")
        return False

    print(f"📂 Source SQLite DB: {sqlite_path} ({sqlite_file.stat().st_size:,} bytes)")
    
    # Hide password in displayed MySQL URL
    safe_mysql_url = mysql_url
    if "@" in safe_mysql_url and ":" in safe_mysql_url.split("@")[0]:
        prefix, rest = safe_mysql_url.split("@", 1)
        scheme_user = prefix.split(":", 2)
        if len(scheme_user) >= 3:
            safe_mysql_url = f"{scheme_user[0]}:{scheme_user[1]}:****@{rest}"
    print(f"🐬 Target MySQL DB: {safe_mysql_url}")
    print("-" * 70)

    sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")
    
    try:
        mysql_engine = create_engine(
            mysql_url,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        # Test connection
        with mysql_engine.connect() as test_conn:
            version_res = test_conn.execute(text("SELECT VERSION()")).scalar()
            print(f"✅ Connected to MySQL Server version: {version_res}")
    except Exception as e:
        print(f"❌ Failed to connect to MySQL database:")
        print(f"   {e}")
        print("\n💡 Troubleshooting tips:")
        print("   1. Ensure MySQL server is running (e.g., `docker compose up -d mysql` or local service).")
        print("   2. Verify credentials in .env (MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE).")
        print("   3. Ensure target database exists: `CREATE DATABASE diagnolab_db CHARACTER SET utf8mb4;`")
        return False

    # 2. Create tables if requested
    if create_tables:
        print("\n🔨 Ensuring all tables exist in MySQL target database...")
        try:
            Base.metadata.create_all(bind=mysql_engine)
            print("✅ All tables created/verified successfully in MySQL.")
        except Exception as e:
            print(f"❌ Error creating tables in MySQL: {e}")
            return False

    # 3. Migrate data table by table
    print("\n📦 Migrating table records...")
    migration_summary = []

    # Get ordered list of tables present in metadata
    ordered_tables: List[Table] = []
    seen = set()
    for tbl_name in TABLE_MIGRATION_ORDER:
        if tbl_name in Base.metadata.tables:
            ordered_tables.append(Base.metadata.tables[tbl_name])
            seen.add(tbl_name)
    # Append any remaining tables
    for tbl_name, tbl in Base.metadata.tables.items():
        if tbl_name not in seen:
            ordered_tables.append(tbl)

    with sqlite_engine.connect() as src_conn, mysql_engine.connect() as dst_conn:
        # Disable foreign key checks for safe bulk loading
        dst_conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        dst_conn.commit()

        try:
            for table in ordered_tables:
                tbl_name = table.name
                
                # Check if table exists in SQLite source
                try:
                    src_count = src_conn.execute(text(f"SELECT COUNT(*) FROM {tbl_name}")).scalar()
                except Exception:
                    # Table might not exist in SQLite
                    src_count = 0

                if src_count == 0:
                    migration_summary.append({
                        "table": tbl_name,
                        "src_count": 0,
                        "dst_count": 0,
                        "status": "SKIPPED (Empty)",
                    })
                    continue

                if truncate_target:
                    dst_conn.execute(text(f"TRUNCATE TABLE {tbl_name};"))
                    dst_conn.commit()

                # Read all rows from SQLite
                src_rows = src_conn.execute(select(table)).mappings().all()
                clean_rows = [sanitize_row_values(dict(row)) for row in src_rows]

                # Insert in batches
                inserted_count = 0
                for i in range(0, len(clean_rows), batch_size):
                    batch = clean_rows[i:i + batch_size]
                    if batch:
                        dst_conn.execute(table.insert(), batch)
                        dst_conn.commit()
                        inserted_count += len(batch)

                # Verify target count
                dst_count = dst_conn.execute(text(f"SELECT COUNT(*) FROM {tbl_name}")).scalar()
                status = "MATCH" if src_count == dst_count else "MISMATCH"

                print(f"  • {tbl_name:<25} : {src_count:>5} -> {dst_count:>5} [{status}]")
                migration_summary.append({
                    "table": tbl_name,
                    "src_count": src_count,
                    "dst_count": dst_count,
                    "status": status,
                })

        finally:
            # Always restore foreign key checks
            dst_conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            dst_conn.commit()

    # 4. Summary Report
    print("\n" + "=" * 70)
    print("📊 MIGRATION SUMMARY REPORT")
    print("=" * 70)
    print(f"{'Table Name':<30} | {'SQLite':<8} | {'MySQL':<8} | {'Status':<15}")
    print("-" * 70)
    
    total_src = 0
    total_dst = 0
    all_matched = True

    for item in migration_summary:
        total_src += item["src_count"]
        total_dst += item["dst_count"]
        if item["status"] not in ("MATCH", "SKIPPED (Empty)"):
            all_matched = False
        print(f"{item['table']:<30} | {item['src_count']:<8} | {item['dst_count']:<8} | {item['status']:<15}")

    print("-" * 70)
    print(f"{'TOTAL RECORDS':<30} | {total_src:<8} | {total_dst:<8} | {'SUCCESS' if all_matched else 'WARNING'}")
    print("=" * 70)

    if all_matched:
        print("🎉 Migration completed successfully! MySQL is now ready for production use.")
    else:
        print("⚠️ Migration completed with some warnings. Please inspect rows marked MISMATCH.")

    return all_matched


def main():
    parser = argparse.ArgumentParser(description="Migrate DiagnoLab database from SQLite to MySQL.")
    parser.add_argument(
        "--sqlite-path",
        type=str,
        default=None,
        help="Path to SQLite database file (default: backend/diagnolab.db)",
    )
    parser.add_argument(
        "--mysql-url",
        type=str,
        default=None,
        help="Target MySQL connection URL (e.g. mysql+pymysql://user:pwd@host:port/db)",
    )
    parser.add_argument(
        "--no-create-tables",
        action="store_true",
        help="Skip auto-creating tables in MySQL",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Truncate target tables before inserting data",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Number of records to insert per batch (default: 500)",
    )

    args = parser.parse_args()

    sqlite_path = find_sqlite_file(args.sqlite_path)
    mysql_url = get_mysql_sync_url(args.mysql_url)

    success = migrate_sqlite_to_mysql(
        sqlite_path=sqlite_path,
        mysql_url=mysql_url,
        create_tables=not args.no_create_tables,
        truncate_target=args.truncate,
        batch_size=args.batch_size,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
