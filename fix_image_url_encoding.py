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

def encode_url_path(url_path):
    if not url_path or not url_path.startswith('/'):
        return url_path
    
    # Split path by slashes and encode each segment properly for web browsers
    parts = url_path.split('/')
    encoded_parts = [urllib.parse.quote(part) for part in parts]
    return '/'.join(encoded_parts)

def fix_all_urls():
    print("Encoding all product image URLs for web browsers...")

    # 1. Update grocery_catalog.json
    with open(GROCERY_JSON, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    for item in catalog:
        raw_url = item.get("Product Image URL", "")
        item["Product Image URL"] = encode_url_path(raw_url)

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

        updates = []
        for pid, raw_url in rows:
            updates.append((encode_url_path(raw_url), pid))

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
            r["image_placeholder_url"] = encode_url_path(r.get("image_placeholder_url", ""))

        with open(MASTER_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    print("Success: All image URLs encoded properly for web browsers!")

if __name__ == "__main__":
    fix_all_urls()
