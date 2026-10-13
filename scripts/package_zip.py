#!/usr/bin/env python3
"""
TradebottenAnna Project Packaging Script
Packages the clean project into a downloadable ZIP archive.
Strictly excludes secrets, environment files, node_modules, and cache files.
"""

import os
import zipfile
import sys

def create_delivery_zip(output_path="tradebottenanna_delivery.zip"):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_zip = os.path.join(base_dir, output_path)

    exclude_dirs = {
        ".git", "node_modules", "dist", "__pycache__", ".pytest_cache",
        ".wrangler", ".venv", "venv", ".aistudio"
    }
    exclude_files = {
        "tradebottenanna_delivery.zip", ".env", ".DS_Store"
    }

    print(f"Creating clean delivery zip at: {target_zip}")
    with zipfile.ZipFile(target_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(base_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith(".aistudio")]
            for file in files:
                if file in exclude_files or file.endswith(".pyc") or file.endswith(".DS_Store"):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, base_dir)
                zipf.write(full_path, rel_path)

    print(f"ZIP package ready: {os.path.getsize(target_zip)} bytes")
    return target_zip

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "tradebottenanna_delivery.zip"
    create_delivery_zip(out)
