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

def build_image_index():
    print("Indexing local product images in public/product_images...")
    all_files = glob.glob(os.path.join(IMAGES_DIR, "**", "*.jpg"), recursive=True)
    all_files += glob.glob(os.path.join(IMAGES_DIR, "**", "*.png"), recursive=True)
    
    indexed = []
    for filepath in all_files:
        rel_path = "/" + os.path.relpath(filepath, PUBLIC_DIR).replace("\\", "/")
        filename = os.path.basename(filepath).lower()
        indexed.append((filename, rel_path, filepath))
        
    print(f"Indexed {len(indexed)} local image files!")
    return indexed

def normalize_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    return text.strip()

def find_best_image(product_name, brand, pack_size, mrp, category, image_index):
    norm_name = normalize_text(product_name)
    norm_brand = normalize_text(brand)
    
    best_match = None
    best_score = 0

    for filename, rel_path, full_path in image_index:
        score = 0
        # Brand match
        if norm_brand and norm_brand in filename:
            score += 40
            
        # Name keywords match
        words = [w for w in norm_name.split() if len(w) > 2]
        for w in words:
            if w in filename:
                score += 10
                
        # Category folder match
        cat_folder = category.lower().replace("&", "").replace(",", "")
        if any(c in filename for c in cat_folder.split()):
            score += 5

        if score > best_score:
            best_score = score
            best_match = rel_path

    if best_match and best_score >= 30:
        return best_match

    # Fallback to category default image or PRD default
    return "/product_images/PRD000001.jpg"

def main():
    image_index = build_image_index()
    
    # 1. Update grocery_catalog.json
    print(f"Updating {GROCERY_JSON}...")
    with open(GROCERY_JSON, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    updated_count = 0
    for p in catalog:
        img_url = find_best_image(
            p.get("Product Name", ""),
            p.get("Brand", ""),
            p.get("Pack Size", ""),
            p.get("MRP", 0),
            p.get("Category", ""),
            image_index
        )
        p["Product Image URL"] = img_url
        updated_count += 1

    with open(GROCERY_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
    print(f"Updated {updated_count} items in {GROCERY_JSON}")

    # 2. Update grouped_grocery_catalog.json
    print(f"Updating {GROUPED_JSON}...")
    grouped = {}
    for item in catalog:
        cat = item.get("Category", "General")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(item)

    with open(GROUPED_JSON, "w", encoding="utf-8") as f:
        json.dump(grouped, f, indent=2)
    print(f"Updated {GROUPED_JSON}")

    # 3. Update Prisma dev.db
    if os.path.exists(PRISMA_DB):
        print(f"Updating Prisma database at {PRISMA_DB}...")
        conn = sqlite3.connect(PRISMA_DB)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, name FROM Product")
        rows = cursor.fetchall()
        
        updates = []
        for pid, name in rows:
            brand = name.split()[0] if name else ""
            img_url = find_best_image(name, brand, "", 0, "General", image_index)
            updates.append((img_url, pid))
            
        cursor.executemany("UPDATE Product SET image = ? WHERE id = ?", updates)
        conn.commit()
        conn.close()
        print("Updated Prisma dev.db with local product images!")

    # 4. Update Master CSV
    if os.path.exists(MASTER_CSV):
        print(f"Updating Master CSV at {MASTER_CSV}...")
        with open(MASTER_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            rows = list(reader)

        for r in rows:
            img_url = find_best_image(
                r.get("product_name", ""),
                r.get("brand", ""),
                r.get("pack_size", ""),
                r.get("mrp", 0),
                r.get("category", ""),
                image_index
            )
            r["image_placeholder_url"] = img_url

        with open(MASTER_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print("Updated Master CSV with local product images!")

if __name__ == "__main__":
    main()
