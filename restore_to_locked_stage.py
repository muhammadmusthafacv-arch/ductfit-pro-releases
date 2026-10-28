"""
Restore Script for Ductfit Pro - Locked Default Stage
Restores all core application code, templates, styling, engines,
and configurations back to the user's locked default baseline.

Usage:
    python restore_to_locked_stage.py
"""

import os
import shutil
import sys

BACKUP_DIR = os.path.join(os.path.dirname(__file__), ".locked_stage_backup")

FILES_TO_RESTORE = [
    "app.py",
    "ashrae_engine.py",
    "ashrae_official_runner.py",
    "pdf_report_generator.py",
    "pdf_master_catalog.py",
    "project_manager.py",
    "version_manager.py",
    "version.json",
    "projects.json",
    "fittings_tree.json",
    "USER_DIRECTIVES.md",
    "README.md",
    "requirements.txt",
    "run_app.bat",
    "package.json"
]

DIRS_TO_RESTORE = [
    "templates",
    "static",
    "ashrae_data"
]

def restore():
    if not os.path.exists(BACKUP_DIR):
        print(f"Error: Locked backup directory '{BACKUP_DIR}' not found!")
        sys.exit(1)

    print("Restoring Ductfit Pro to Locked Default Stage (Baseline 28-Oct-2026)...")

    for f in FILES_TO_RESTORE:
        src = os.path.join(BACKUP_DIR, f)
        if os.path.exists(src):
            shutil.copy2(src, f)
            print(f"  [OK] Restored {f}")

    for d in DIRS_TO_RESTORE:
        src = os.path.join(BACKUP_DIR, d)
        if os.path.exists(src):
            shutil.copytree(src, d, dirs_exist_ok=True)
            print(f"  [OK] Restored directory {d}/")

    print("\nSuccessfully restored application to Locked Default Stage!")

if __name__ == "__main__":
    restore()
