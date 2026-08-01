import sqlite3
import csv
import json
import os

MASTER_CSV_PATH = r"c:\Users\sahil\OneDrive\Desktop\product list of bhusawal connect\bhusawal_connect_master_catalog.csv"
PUBLIC_DIR = r"c:\Users\sahil\OneDrive\Desktop\bhusawal connect\public"
GROCERY_JSON_PATH = os.path.join(PUBLIC_DIR, "grocery_catalog.json")
GROUPED_JSON_PATH = os.path.join(PUBLIC_DIR, "grouped_grocery_catalog.json")

# Mapping master catalog categories to Astro frontend categories
ASTRO_CATEGORY_MAP = {
    "Fresh Fruits": "Fruits & Vegetables",
    "Fresh Vegetables": "Fruits & Vegetables",
    "Leafy Vegetables & Herbs": "Fruits & Vegetables",
    "Exotic Produce & Sprouts": "Fruits & Vegetables",
    "Atta & Flours": "Atta, Rice & Dal",
    "Rice & Rice Products": "Atta, Rice & Dal",
    "Dals & Pulses": "Atta, Rice & Dal",
    "Edible Oils & Ghee": "Oil, Ghee & Masala",
    "Spices & Masalas": "Oil, Ghee & Masala",
    "Salt, Sugar & Jaggery": "Salt, Sugar & Jaggery",
    "Dry Fruits, Seeds & Nuts": "Atta, Rice & Dal",
    "Milk & Cream": "Dairy & Breakfast",
    "Curd, Paneer & Butter": "Dairy & Breakfast",
    "Bread, Buns & Bakery": "Dairy & Breakfast",
    "Cereals & Breakfast Mixes": "Dairy & Breakfast",
    "Chips & Namkeen": "Chips & Wafers",
    "Biscuits & Cookies": "Biscuits & Cookies",
    "Chocolates & Candies": "Chocolates & Candies",
    "Instant Noodles & Pasta": "Chips & Wafers",
    "Ready to Cook & Instant Mixes": "Chips & Wafers",
    "Frozen Veg Snacks & Ice Cream": "Dairy & Breakfast",
    "Tea & Coffee": "Oil, Ghee & Masala",
    "Soft Drinks & Juices": "Soft Drinks",
    "Bath Soaps & Body Wash": "Personal Care",
    "Hair Care (Shampoo & Oil)": "Personal Care",
    "Oral Care": "Personal Care",
    "Detergents & Dishwash": "Cleaning",
    "Surface & Toilet Cleaners": "Cleaning",
    "Household Essentials": "Cleaning",
    "Baby Care & Diapers": "Baby Care",
    "Pooja Needs": "Pooja"
}

def sync_catalog():
    print("Syncing master catalog to Astro frontend JSON files...")
    
    with open(MASTER_CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        master_rows = list(reader)
        
    astro_catalog = []
    for p in master_rows:
        sub_cat = p.get("sub_category", "")
        cat = p.get("category", "")
        astro_cat = ASTRO_CATEGORY_MAP.get(sub_cat, ASTRO_CATEGORY_MAP.get(cat, cat))
        
        mrp_val = float(p.get("mrp", 0))
        selling_val = float(p.get("selling_price", mrp_val))
        
        item = {
            "ProductID": p.get("product_id"),
            "Product Name": p.get("display_name") or p.get("product_name"),
            "Category": astro_cat,
            "Subcategory": sub_cat or cat,
            "Brand": p.get("brand"),
            "MRP": round(selling_val),
            "OriginalMRP": round(mrp_val),
            "Pack Size": p.get("pack_size"),
            "Product Image URL": p.get("image_placeholder_url"),
            "Description": p.get("short_description"),
            "StockQuantity": str(p.get("stock_quantity", 50)),
            "VegNonVeg": "Veg" if p.get("vegetarian") == "True" else "Non-Veg"
        }
        astro_catalog.append(item)

    print(f"Writing {len(astro_catalog)} items to {GROCERY_JSON_PATH}...")
    with open(GROCERY_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(astro_catalog, f, indent=2)

    # Grouped JSON
    grouped = {}
    for item in astro_catalog:
        c = item["Category"]
        if c not in grouped:
            grouped[c] = []
        grouped[c].append(item)
        
    print(f"Writing grouped catalog to {GROUPED_JSON_PATH}...")
    with open(GROUPED_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(grouped, f, indent=2)

    print("Success: Astro frontend catalog JSON files updated cleanly!")

if __name__ == "__main__":
    sync_catalog()
