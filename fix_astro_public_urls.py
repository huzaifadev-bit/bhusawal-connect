import os
import json
import csv
import sqlite3
import urllib.parse

PUBLIC_DIR = r"c:\Users\sahil\OneDrive\Desktop\bhusawal connect\public"
GROCERY_JSON = os.path.join(PUBLIC_DIR, "grocery_catalog.json")
GROUPED_JSON = os.path.join(PUBLIC_DIR, "grouped_grocery_catalog.json")
MASTER_CSV = r"c:\Users\sahil\OneDrive\Desktop\product list of bhusawal connect\bhusawal_connect_master_catalog.csv"
PRISMA_DB = r"c:\Users\sahil\OneDrive\Desktop\bhusawal connect\backend\prisma\dev.db"

def clean_astro_path(url):
    if not url:
        return "/product_images/PRD000001.jpg"
        
    # Unquote any double-encoded %2F or %20 first
    unquoted = urllib.parse.unquote(url)
    
    # Ensure it starts with a single leading slash '/'
    if not unquoted.startswith('/'):
        unquoted = '/' + unquoted

    # Ensure path starts with /product_images/
    if not unquoted.startswith('/product_images/'):
        unquoted = '/product_images/' + unquoted.lstrip('/')

    return unquoted

def fix_all_astro_urls():
    print("Fixing Astro public relative paths (resolving DNS_PROBE_FINISHED_NXDOMAIN)...")

    # 1. Update grocery_catalog.json
    with open(GROCERY_JSON, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    for item in catalog:
        raw_url = item.get("Product Image URL", "")
        item["Product Image URL"] = clean_astro_path(raw_url)

    with open(GROCERY_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    # 2. Update grouped_grocery_catalog.json
    grouped = {}
    for item in catalog:
        c = item.get("Category", "General")
        if c not in grouped:
            grouped[c] = []
        grouped[c].append(item)

    with open(GROUPED_JSON, "w", encoding="utf-8") as f:
        json.dump(grouped, f, indent=2)

    # 3. Update Prisma dev.db
    if os.path.exists(PRISMA_DB):
        conn = sqlite3.connect(PRISMA_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT id, image FROM Product")
        rows = cursor.fetchall()

        updates = [(clean_astro_path(raw_url), pid) for pid, raw_url in rows]
        cursor.executemany("UPDATE Product SET image = ? WHERE id = ?", updates)
        conn.commit()
        conn.close()

    # 4. Update Master CSV
    if os.path.exists(MASTER_CSV):
        with open(MASTER_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            rows = list(reader)

        for r in rows:
            r["image_placeholder_url"] = clean_astro_path(r.get("image_placeholder_url", ""))

        with open(MASTER_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    print("Success: Fixed relative image URLs for Astro web server!")

if __name__ == "__main__":
    fix_all_astro_urls()
