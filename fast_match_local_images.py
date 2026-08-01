import os
import glob
import json
import csv
import sqlite3
import re

PUBLIC_DIR = r"c:\Users\sahil\OneDrive\Desktop\bhusawal connect\public"
IMAGES_DIR = os.path.join(PUBLIC_DIR, "product_images")
GROCERY_JSON = os.path.join(PUBLIC_DIR, "grocery_catalog.json")
GROUPED_JSON = os.path.join(PUBLIC_DIR, "grouped_grocery_catalog.json")
MASTER_CSV = r"c:\Users\sahil\OneDrive\Desktop\product list of bhusawal connect\bhusawal_connect_master_catalog.csv"
PRISMA_DB = r"c:\Users\sahil\OneDrive\Desktop\bhusawal connect\backend\prisma\dev.db"

def main():
    print("Building instant index for local product images...")
    all_files = glob.glob(os.path.join(IMAGES_DIR, "**", "*.*"), recursive=True)
    
    brand_map = {}
    fallback_map = {}
    
    for filepath in all_files:
        if not filepath.lower().endswith(('.jpg', '.png', '.jpeg', '.webp')):
            continue
        rel_path = "/" + os.path.relpath(filepath, PUBLIC_DIR).replace("\\", "/")
        filename_lower = os.path.basename(filepath).lower()
        
        # Key by first word of filename (Brand or Item Name)
        first_word = filename_lower.split('_')[0].split('-')[0].split()[0]
        if first_word and first_word not in brand_map:
            brand_map[first_word] = rel_path

        # Key by category directory
        parent_dir = os.path.basename(os.path.dirname(filepath)).lower()
        if parent_dir and parent_dir not in fallback_map:
            fallback_map[parent_dir] = rel_path

    print(f"Indexed {len(all_files)} images across {len(brand_map)} brand keywords.")

    def match_url(p_name, p_brand, p_cat):
        p_name_lower = p_name.lower()
        p_brand_lower = p_brand.lower()
        
        # 1. Match brand first word
        for brand_key, url in brand_map.items():
            if len(brand_key) > 2 and (brand_key in p_brand_lower or brand_key in p_name_lower):
                return url
                
        # 2. Match category folder
        cat_lower = p_cat.lower()
        for cat_key, url in fallback_map.items():
            if any(k in cat_lower for k in cat_key.split()):
                return url
                
        return "/product_images/PRD000001.jpg"

    # 1. Update grocery_catalog.json
    print(f"Updating {GROCERY_JSON}...")
    with open(GROCERY_JSON, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    for item in catalog:
        item["Product Image URL"] = match_url(
            item.get("Product Name", ""),
            item.get("Brand", ""),
            item.get("Category", "")
        )

    with open(GROCERY_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
        
    # 2. Update grouped_grocery_catalog.json
    print(f"Updating {GROUPED_JSON}...")
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
        print(f"Updating Prisma dev.db...")
        conn = sqlite3.connect(PRISMA_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM Product")
        rows = cursor.fetchall()
        
        updates = []
        for pid, name in rows:
            brand = name.split()[0] if name else ""
            img_url = match_url(name, brand, "General")
            updates.append((img_url, pid))
            
        cursor.executemany("UPDATE Product SET image = ? WHERE id = ?", updates)
        conn.commit()
        conn.close()

    # 4. Update Master CSV
    if os.path.exists(MASTER_CSV):
        print(f"Updating Master CSV...")
        with open(MASTER_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            rows = list(reader)

        for r in rows:
            r["image_placeholder_url"] = match_url(
                r.get("product_name", ""),
                r.get("brand", ""),
                r.get("category", "")
            )

        with open(MASTER_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    print("Success: All local product image packshots matched and updated!")

if __name__ == "__main__":
    main()
