import sys
import json
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

if len(sys.argv) < 3:
    print("Usage: python update_single_product_image.py \"ProductNameOrBrand\" \"NewImageUrl\"")
    sys.exit(1)

query = sys.argv[1].strip()
image_url = sys.argv[2].strip()

catalog_path = os.path.join(os.getcwd(), "public", "grocery_catalog.json")
grouped_catalog_path = os.path.join(os.getcwd(), "public", "grouped_grocery_catalog.json")

if not os.path.exists(catalog_path):
    print(f"Error: {catalog_path} not found.")
    sys.exit(1)

with open(catalog_path, "r", encoding="utf-8") as f:
    catalog = json.load(f)

updated_products = []
query_words = [w.lower() for w in query.split() if w.strip()]

for item in catalog:
    name = (item.get("Product Name") or "").lower()
    brand = (item.get("Brand") or "").lower()
    cat = (item.get("Category") or "").lower()
    subcat = (item.get("Subcategory") or "").lower()
    combined = f"{name} {brand} {cat} {subcat}"
    
    if all(word in combined for word in query_words):
        item["Product Image URL"] = image_url
        updated_products.append(item.get("Product Name"))

if updated_products:
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    # Rebuild grouped catalog
    grouped = {}
    for item in catalog:
        c = item.get("Category", "General")
        if c not in grouped:
            grouped[c] = []
        grouped[c].append(item)

    with open(grouped_catalog_path, "w", encoding="utf-8") as f:
        json.dump(grouped, f, indent=2, ensure_ascii=False)

    print(f"SUCCESS: Updated {len(updated_products)} product(s) matching '{query}':")
    for name in updated_products[:10]:
        print(f" - {name}")
    if len(updated_products) > 10:
        print(f" ... and {len(updated_products) - 10} more.")
else:
    print(f"WARNING: No products found matching '{query}'. Catalog remains unchanged.")
