import json
import csv
import os

MASTER_CSV = r"c:\Users\sahil\OneDrive\Desktop\product list of bhusawal connect\bhusawal_connect_master_catalog.csv"
TXT_OUTPUT_1 = r"c:\Users\sahil\OneDrive\Desktop\product list of bhusawal connect\all_product_names_bhusawal_connect.txt"
TXT_OUTPUT_2 = r"c:\Users\sahil\OneDrive\Desktop\bhusawal connect\public\all_product_names.txt"

def export_names():
    print("Exporting all product names to plain text format...")
    
    with open(MASTER_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        names = []
        for i, row in enumerate(reader, 1):
            name = row.get("display_name") or row.get("product_name")
            category = row.get("category", "")
            brand = row.get("brand", "")
            pack = row.get("pack_size", "")
            mrp = row.get("mrp", "")
            names.append(f"{i}. {name} | Brand: {brand} | Pack: {pack} | MRP: ₹{mrp} | Category: {category}")

    print(f"Extracted {len(names)} product names.")

    # Write to desktop folder
    with open(TXT_OUTPUT_1, "w", encoding="utf-8") as f:
        f.write(f"=== BHUSAWAL CONNECT MASTER CATALOG — ALL {len(names)} PRODUCTS ===\n\n")
        f.write("\n".join(names))

    # Write to web public folder
    with open(TXT_OUTPUT_2, "w", encoding="utf-8") as f:
        f.write(f"=== BHUSAWAL CONNECT MASTER CATALOG — ALL {len(names)} PRODUCTS ===\n\n")
        f.write("\n".join(names))

    print(f"Saved text list to:\n1. {TXT_OUTPUT_1}\n2. {TXT_OUTPUT_2}")

if __name__ == "__main__":
    export_names()
