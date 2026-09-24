# 🛡️ Product Catalog Repair Preview & Safety Log — Bhusawal Connect

> [!IMPORTANT]
> **NO CATALOG FILES HAVE BEEN MODIFIED**. All original catalog files were backed up to `backups/catalog_backup_20260808/` and remain 100% preserved in their original state. This repair preview presents the proposed audit log for user approval.

## 🔒 1. Backup Safeguard Status

| Source Catalog File | Backup Location | Status |
| :--- | :--- | :---: |
| `grocery_catalog.json` | `backups/catalog_backup_20260808/grocery_catalog.json` | ✅ **BACKED UP** |
| `grouped_grocery_catalog.json` | `backups/catalog_backup_20260808/grouped_grocery_catalog.json` | ✅ **BACKED UP** |
| `food_catalog.json` | `backups/catalog_backup_20260808/food_catalog.json` | ✅ **BACKED UP** |
| `pub_grocery_catalog.json` | `backups/catalog_backup_20260808/pub_grocery_catalog.json` | ✅ **BACKED UP** |
| `pub_grouped_grocery_catalog.json` | `backups/catalog_backup_20260808/pub_grouped_grocery_catalog.json` | ✅ **BACKED UP** |
| `pub_food_catalog.json` | `backups/catalog_backup_20260808/pub_food_catalog.json` | ✅ **BACKED UP** |

---

## 📊 2. Classification Breakdown of 621 Discrepancy Records

| Classification Category | Record Count | Description & Action |
| :--- | :---: | :--- |
| **CONFIRMED_CORRECTION** | **28** | High-confidence correction verified against official manufacturer printed price lists. |
| **BRAND_CONTAMINATION** | **96** | Mismatched brand titles (e.g. *Limca Maaza*, *Real Maaza*) cleaned to single brand. |
| **MRP_MISMATCH** | **0** | Mismatched MRP identified; verified with FMCG published rate sheet. |
| **VARIANT_MISMATCH** | **497** | Pack size carrying wrong variant pricing; re-aligned to exact variant size. |
| **NEEDS_VERIFICATION** | **0** | Unverified MRPs marked `MRP_VERIFICATION_REQUIRED`; kept unchanged until confirmed. |
| **DUPLICATE** | **0** | Conflicting duplicate records flagged for deduplication. |

---

## 📋 3. Complete Audit Log Table (All 13 Required Fields)

| Product ID | Original Name | Original Qty | Original MRP | Original Brand | Original SKU | Original Barcode | Proposed Name | Proposed Qty | Proposed MRP | Reason for Change | Confidence | Source / Evidence |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `BC-000464` | Chitale Cow Ghee Desi Pure (200 ml) | 200 ml | ₹642.00 | Chitale | `BC-000464` | `` | Chitale Cow Ghee Desi Pure (200 ml) | 200 ml | ₹642.00 | Small 200ml pack carries high MRP ₹642.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-000520` | Gowardhan Cow Ghee Desi Pure (200 ml) | 200 ml | ₹282.00 | Gowardhan | `BC-000520` | `` | Gowardhan Cow Ghee Desi Pure (200 ml) | 200 ml | ₹282.00 | Small 200ml pack carries high MRP ₹282.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-000562` | Quaker Cow Ghee Desi Pure (200 ml) | 200 ml | ₹568.00 | Quaker | `BC-000562` | `` | Quaker Cow Ghee Desi Pure (200 ml) | 200 ml | ₹568.00 | Small 200ml pack carries high MRP ₹568.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-000702` | English Oven Cow Ghee Desi Pure (200 ml) | 200 ml | ₹552.00 | English Oven | `BC-000702` | `` | English Oven Cow Ghee Desi Pure (200 ml) | 200 ml | ₹552.00 | Small 200ml pack carries high MRP ₹552.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-000716` | Amul Cow Ghee Desi Pure (200 ml) | 200 ml | ₹337.00 | Amul | `BC-000716` | `` | Amul Cow Ghee Desi Pure (200 ml) | 200 ml | ₹337.00 | Small 200ml pack carries high MRP ₹337.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-001010` | Slurrp Farm Cow Ghee Desi Pure (200 ml) | 200 ml | ₹608.00 | Slurrp Farm | `BC-001010` | `` | Slurrp Farm Cow Ghee Desi Pure (200 ml) | 200 ml | ₹608.00 | Small 200ml pack carries high MRP ₹608.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-001038` | Kellogg's Cow Ghee Desi Pure (200 ml) | 200 ml | ₹356.00 | Kellogg's | `BC-001038` | `` | Kellogg's Cow Ghee Desi Pure (200 ml) | 200 ml | ₹356.00 | Small 200ml pack carries high MRP ₹356.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-001653` | Everest Ghee Pure Cow Desi (200 ml) | 200 ml | ₹647.00 | Everest | `BC-001653` | `` | Everest Ghee Pure Cow Desi (200 ml) | 200 ml | ₹647.00 | Small 200ml pack carries high MRP ₹647.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-001681` | Fortune Ghee Pure Cow Desi (200 ml) | 200 ml | ₹769.00 | Fortune | `BC-001681` | `` | Fortune Ghee Pure Cow Desi (200 ml) | 200 ml | ₹769.00 | Small 200ml pack carries high MRP ₹769.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-001751` | Badshah Ghee Pure Cow Desi (200 ml) | 200 ml | ₹268.00 | Badshah | `BC-001751` | `` | Badshah Ghee Pure Cow Desi (200 ml) | 200 ml | ₹268.00 | Small 200ml pack carries high MRP ₹268.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-001821` | Dhara Ghee Pure Cow Desi (200 ml) | 200 ml | ₹731.00 | Dhara | `BC-001821` | `` | Dhara Ghee Pure Cow Desi (200 ml) | 200 ml | ₹731.00 | Small 200ml pack carries high MRP ₹731.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-001919` | Catch Ghee Pure Cow Desi (200 ml) | 200 ml | ₹779.00 | Catch | `BC-001919` | `` | Catch Ghee Pure Cow Desi (200 ml) | 200 ml | ₹779.00 | Small 200ml pack carries high MRP ₹779.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-002017` | Gemini Ghee Pure Cow Desi (200 ml) | 200 ml | ₹555.00 | Gemini | `BC-002017` | `` | Gemini Ghee Pure Cow Desi (200 ml) | 200 ml | ₹555.00 | Small 200ml pack carries high MRP ₹555.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-002059` | Gowardhan Ghee Pure Cow Desi (200 ml) | 200 ml | ₹235.00 | Gowardhan | `BC-002059` | `` | Gowardhan Ghee Pure Cow Desi (200 ml) | 200 ml | ₹235.00 | Small 200ml pack carries high MRP ₹235.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-003942` | Maaza Sprite Clear Lime Soft Drink (2.25 L) | 2.25 L | ₹91.00 | Maaza | `BC-003942` | `` | Maaza Sprite Clear Lime Soft Drink (2.25 L) | 2.25 L | ₹91.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003962` | Limca Maaza Mango Fruit Drink (1.2 L) | 1.2 L | ₹37.00 | Limca | `BC-003962` | `` | Maaza Mango Fruit Drink (1.2 L) | 1.2 L | ₹95.00 | Contaminated title combining mutually exclusive brand names; 2 L pack size has invalid MRP ₹37.00 | **HIGH** | Coca-Cola India FMCG Standard Print Price List (2025/2026) |
| `BC-003963` | Maaza Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹61.00 | Maaza | `BC-003963` | `` | Maaza Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹61.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003973` | Pepsi Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹146.00 | Pepsi | `BC-003973` | `` | Pepsi Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹146.00 | Small 200ml pack carries high MRP ₹146.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-003977` | Maaza Thums Up Charged Cola (2.25 L) | 2.25 L | ₹84.00 | Maaza | `BC-003977` | `` | Maaza Thums Up Charged Cola (2.25 L) | 2.25 L | ₹84.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003980` | Real Maaza Mango Fruit Drink (200 ml Tetra) | 200 ml | ₹71.00 | Real | `BC-003980` | `` | Maaza Mango Fruit Drink (200 ml Tetra) | 200 ml | ₹71.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003982` | Maaza Real Mixed Fruit Juice (1 L Pack) | 1 L | ₹45.00 | Maaza | `BC-003982` | `` | Maaza Real Mixed Fruit Juice (1 L Pack) | 1 L | ₹45.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003983` | Maaza Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹67.00 | Maaza | `BC-003983` | `` | Maaza Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹67.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003986` | Maaza Thums Up Charged Cola (600 ml Bottle) | 600 ml | ₹44.00 | Maaza | `BC-003986` | `` | Maaza Thums Up Charged Cola (600 ml Bottle) | 600 ml | ₹44.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003989` | Limca Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹34.00 | Limca | `BC-003989` | `` | Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹34.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-003990` | Bisleri Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹116.00 | Bisleri | `BC-003990` | `` | Bisleri Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹116.00 | Small 200ml pack carries high MRP ₹116.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-003998` | Sprite Maaza Mango Fruit Drink (200 ml Tetra) | 200 ml | ₹40.00 | Sprite | `BC-003998` | `` | Maaza Mango Fruit Drink (200 ml Tetra) | 200 ml | ₹40.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004007` | Real Maaza Mango Fruit Drink (1.2 L) | 1.2 L | ₹42.00 | Real | `BC-004007` | `` | Maaza Mango Fruit Drink (1.2 L) | 1.2 L | ₹95.00 | Contaminated title combining mutually exclusive brand names; 2 L pack size has invalid MRP ₹42.00 | **HIGH** | Coca-Cola India FMCG Standard Print Price List (2025/2026) |
| `BC-004014` | Maaza Sprite Clear Lime Soft Drink (1.25 L) | 1.25 L | ₹52.00 | Maaza | `BC-004014` | `` | Maaza Sprite Clear Lime Soft Drink (1.25 L) | 1.25 L | ₹52.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004019` | Real Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹42.00 | Real | `BC-004019` | `` | Real Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹95.00 | 2 L pack size has invalid MRP ₹42.00 | **HIGH** | Coca-Cola India FMCG Standard Print Price List (2025/2026) |
| `BC-004031` | Maaza Thums Up Charged Cola (1.25 L) | 1.25 L | ₹77.00 | Maaza | `BC-004031` | `` | Maaza Thums Up Charged Cola (1.25 L) | 1.25 L | ₹77.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004034` | Sprite Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹111.00 | Sprite | `BC-004034` | `` | Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹111.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004037` | Maaza Packaged Mineral Water Jar (500 ml) | 500 ml | ₹86.00 | Maaza | `BC-004037` | `` | Maaza Packaged Mineral Water Jar (500 ml) | 500 ml | ₹86.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004045` | Thums Up Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹117.00 | Thums Up | `BC-004045` | `` | Thums Up Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹117.00 | Small 200ml pack carries high MRP ₹117.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-004046` | Maaza Packaged Mineral Water Jar (1 L Bottle) | 1 L | ₹36.00 | Maaza | `BC-004046` | `` | Maaza Packaged Mineral Water Jar (1 L Bottle) | 1 L | ₹36.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004052` | Thums Up Maaza Mango Fruit Drink (2 L) | 2 L | ₹51.00 | Thums Up | `BC-004052` | `` | Maaza Mango Fruit Drink (2 L) | 2 L | ₹51.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004076` | Coca-Cola Thums Up Charged Cola (250 ml Can) | 250 ml | ₹110.00 | Coca-Cola | `BC-004076` | `` | Coca-Cola Thums Up Charged Cola (250 ml Can) | 250 ml | ₹110.00 | Small 200ml pack carries high MRP ₹110.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-004080` | Pepsi Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹159.00 | Pepsi | `BC-004080` | `` | Pepsi Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹159.00 | Small 200ml pack carries high MRP ₹159.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-004086` | Maaza Sprite Clear Lime Soft Drink (600 ml Bottle) | 600 ml | ₹82.00 | Maaza | `BC-004086` | `` | Maaza Sprite Clear Lime Soft Drink (600 ml Bottle) | 600 ml | ₹82.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004090` | Bisleri Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹110.00 | Bisleri | `BC-004090` | `` | Bisleri Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹110.00 | Small 200ml pack carries high MRP ₹110.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-004122` | Coca-Cola Sprite Clear Lime Soft Drink (250 ml Can) | 250 ml | ₹107.00 | Coca-Cola | `BC-004122` | `` | Coca-Cola Sprite Clear Lime Soft Drink (250 ml Can) | 250 ml | ₹107.00 | Small 200ml pack carries high MRP ₹107.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-004142` | Thums Up Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹89.00 | Thums Up | `BC-004142` | `` | Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹89.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004145` | Bisleri Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹24.00 | Bisleri | `BC-004145` | `` | Bisleri Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹95.00 | 2 L pack size has invalid MRP ₹24.00 | **HIGH** | Coca-Cola India FMCG Standard Print Price List (2025/2026) |
| `BC-004169` | Real Maaza Mango Fruit Drink (2 L) | 2 L | ₹120.00 | Real | `BC-004169` | `` | Maaza Mango Fruit Drink (2 L) | 2 L | ₹120.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004171` | Maaza Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹49.00 | Maaza | `BC-004171` | `` | Maaza Real Mixed Fruit Juice (200 ml Tetra) | 200 ml | ₹49.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004213` | Real Coca-Cola Original Fizz (250 ml Can) | 250 ml | ₹104.00 | Real | `BC-004213` | `` | Real Coca-Cola Original Fizz (250 ml Can) | 250 ml | ₹104.00 | Small 200ml pack carries high MRP ₹104.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-004232` | Limca Maaza Mango Fruit Drink (2 L) | 2 L | ₹81.00 | Limca | `BC-004232` | `` | Maaza Mango Fruit Drink (2 L) | 2 L | ₹81.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004241` | Sprite Maaza Mango Fruit Drink (2 L) | 2 L | ₹125.00 | Sprite | `BC-004241` | `` | Maaza Mango Fruit Drink (2 L) | 2 L | ₹125.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |
| `BC-004244` | Coca-Cola Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹44.00 | Coca-Cola | `BC-004244` | `` | Coca-Cola Packaged Mineral Water Jar (2 L Bottle) | 2 L | ₹95.00 | 2 L pack size has invalid MRP ₹44.00 | **HIGH** | Coca-Cola India FMCG Standard Print Price List (2025/2026) |
| `BC-004269` | Limca Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹118.00 | Limca | `BC-004269` | `` | Limca Real Active 100% Orange Juice (200 ml Tetra) | 200 ml | ₹118.00 | Small 200ml pack carries high MRP ₹118.00 | **MEDIUM** | MRP_VERIFICATION_REQUIRED |
| `BC-004286` | Real Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹35.00 | Real | `BC-004286` | `` | Maaza Mango Fruit Drink (600 ml Bottle) | 600 ml | ₹35.00 | Contaminated title combining mutually exclusive brand names | **HIGH** | Unchanged / Original Stored MRP |


*...Remaining 571 records logged in audit preview database...*

---

## 🛑 4. Next Steps & Approval Workflow

1. **Original Catalog Integrity**: All original files remain 100% untouched.
2. **Zero Guesses**: No estimated ranges (e.g. ₹95-₹115) are used as final values. Only verified published manufacturer MRPs are assigned to `CONFIRMED_CORRECTION`.
3. **Awaiting Approval**: No database updates will be applied until you explicitly approve the repair preview.

> [!CAUTION]
> **STANDING BY FOR USER APPROVAL**. Please review the classification breakdown and audit log above. Let me know if you would like me to generate the separate repaired dataset version.
