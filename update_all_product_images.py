import sys
import json
import os
import csv
import sqlite3

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

GROCERY_JSON = os.path.join(os.getcwd(), "public", "grocery_catalog.json")
GROUPED_JSON = os.path.join(os.getcwd(), "public", "grouped_grocery_catalog.json")
PRISMA_DB = os.path.join(os.getcwd(), "backend", "prisma", "dev.db")
MASTER_CSV = r"c:\Users\sahil\OneDrive\Desktop\product list of bhusawal connect\bhusawal_connect_master_catalog.csv"

def print_usage():
    print("=== BHUSAWAL CONNECT: UNIVERSAL IMAGE UPDATER ===")
    print("Usage Options:")
    print(" 1. Update ALL products with one image URL:")
    print("    python update_all_product_images.py \"https://your-image-url.com/image.jpg\"")
    print("\n 2. Update products by Category (e.g. Atta, Oil, Dairy, Chips, Drinks, Soaps):")
    print("    python update_all_product_images.py \"CategoryName\" \"https://your-image-url.com/image.jpg\"")
    print("\n 3. Update products from a CSV file:")
    print("    python update_all_product_images.py \"path/to/my_images.csv\"")

if len(sys.argv) < 2:
    print_usage()
    sys.exit(0)

param1 = sys.argv[1].strip()
param2 = sys.argv[2].strip() if len(sys.argv) > 2 else None

if not os.path.exists(GROCERY_JSON):
    print(f"Error: {GROCERY_JSON} not found.")
    sys.exit(1)

with open(GROCERY_JSON, "r", encoding="utf-8") as f:
    catalog = json.load(f)

updated_count = 0
updated_products = []

# Case 1: param1 is a CSV File
if param1.endswith('.csv') and os.path.exists(param1):
    print(f"Reading CSV mapping file: '{param1}'...")
    mappings = []
    with open(param1, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                mappings.append((row[0].strip(), row[1].strip()))

    for query, image_url in mappings:
        q_words = [w.lower() for w in query.split() if w.strip()]
        for item in catalog:
            combined = f"{item.get('Product Name','')} {item.get('Brand','')} {item.get('Category','')}".lower()
            if all(w in combined for w in q_words):
                item["Product Image URL"] = image_url
                updated_count += 1
                updated_products.append(item.get("Product Name"))

# Case 2: param1 is a single Image URL -> Update ALL 25,500 products
elif param1.startswith("http://") or param1.startswith("https://") or param1.startswith("/product_images/") or param1.startswith("data:image/"):
    image_url = param1
    print(f"Updating ALL products across the entire catalog to: '{image_url}'...")
    for item in catalog:
        item["Product Image URL"] = image_url
        updated_count += 1
        updated_products.append(item.get("Product Name"))

# Case 3: param1 is a Search Query / Category AND param2 is the Image URL
elif param2:
    search_query = param1.lower()
    image_url = param2
    print(f"Updating products matching query/category '{param1}' to: '{image_url}'...")
    q_words = [w.lower() for w in search_query.split() if w.strip()]
    for item in catalog:
        combined = f"{item.get('Product Name','')} {item.get('Brand','')} {item.get('Category','')}".lower()
        if all(w in combined for w in q_words):
            item["Product Image URL"] = image_url
            updated_count += 1
            updated_products.append(item.get("Product Name"))

else:
    print_usage()
    sys.exit(0)

# Save updated JSON catalog
if updated_count > 0:
    with open(GROCERY_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    # Rebuild grouped catalog
    grouped = {}
    for item in catalog:
        c = item.get("Category", "General")
        if c not in grouped:
            grouped[c] = []
        grouped[c].append(item)

    with open(GROUPED_JSON, "w", encoding="utf-8") as f:
        json.dump(grouped, f, indent=2, ensure_ascii=False)

    # Sync Prisma SQLite dev.db if exists
    if os.path.exists(PRISMA_DB):
        conn = sqlite3.connect(PRISMA_DB)
        cursor = conn.cursor()
        if param1.startswith("http://") or param1.startswith("https://") or param1.startswith("/product_images/") or param1.startswith("data:image/"):
            cursor.execute("UPDATE Product SET image = ?", (param1,))
        elif param2:
            cursor.execute("UPDATE Product SET image = ? WHERE name LIKE ? OR brand LIKE ?", (param2, f"%{param1}%", f"%{param1}%"))
        conn.commit()
        conn.close()

    print(f"\nSUCCESS: Updated images for {updated_count} product(s) across all web JSON and SQLite database!")
    print("Sample updated products:")
    for name in updated_products[:5]:
        print(f" • {name}")
    if len(updated_products) > 5:
        print(f" ... and {len(updated_products) - 5} more.")
else:
    print("\nWARNING: No products matched your query. Catalog remains unchanged.")
