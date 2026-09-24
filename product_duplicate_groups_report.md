# 📑 Product Duplicate & Conflicting Group Analysis Report — Bhusawal Connect

> [!IMPORTANT]
> **NON-DESTRUCTIVE SAFE DEDUPLICATION**. No product records were deleted. Genuine variants remain 100% active. Duplicate records have been safely marked with `duplicateOf = CANONICAL_PRODUCT_ID`. Original backups in `backups/catalog_backup_20260808/` remain untouched.

## 📊 1. Duplicate Group Classification Summary

| Category Classification | Number of Groups | Percentage | Handling Rule |
| :--- | :---: | :---: | :--- |
| **1. Genuine different variants** | **1017** | 69.18% | KEPT BOTH ACTIVE |
| **2. Same product duplicated** | **37** | 2.52% | Marked duplicateOf = Canonical ID |
| **3. Same product with different SKU** | **2** | 0.14% | Marked duplicateOf = Canonical ID |
| **4. Same product with conflicting MRP** | **193** | 13.13% | Marked duplicateOf = Canonical ID |
| **5. Same product with different quantity** | **31** | 2.11% | Marked duplicateOf = Canonical ID |
| **6. Incorrect synthetic record** | **190** | 12.93% | Marked duplicateOf = Canonical ID |
| **TOTAL GROUPS ANALYZED** | **1470** | 100.0% | Complete Catalog Coverage |

---

## 📋 2. Sample Group Classification Audit Log (8 Required Fields)

| Group Key | Records Count | Category Classification | Canonical Product ID | Sample Product Name | Variant / Quantity | Conflict / Difference Reason |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `mahafresh :: mahafresh banana robus` | 9 | **4. Same product with conflicting MRP** | `BC-000001` | Mahafresh Banana Robusta (500 g) | 1 dozen | Same product variant listed with conflicting MRPs (₹62.0, ₹70.0, ₹77.0, ₹88.0, ₹92.0) |
| `mahafresh :: mahafresh banana shrim` | 4 | **4. Same product with conflicting MRP** | `BC-000002` | Mahafresh Banana Shrimanti (2 kg) | 1 dozen | Same product variant listed with conflicting MRPs (₹83.0, ₹89.0) |
| `farm fresh :: farm fresh onion nash` | 21 | **1. Genuine different variants** | `BC-000003` | Farm Fresh Onion Nashik Red (2 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 5 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india pota` | 18 | **1. Genuine different variants** | `BC-000004` | Organic India Potato Indore Special (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 5 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india toma` | 13 | **1. Genuine different variants** | `BC-000005` | Organic India Tomato Hybrid Red (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh green chil` | 16 | **1. Genuine different variants** | `BC-000006` | Farm Fresh Green Chilli Tikka (250 g) | 250 g | Distinct pack sizes / variants (100 g, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india ging` | 9 | **1. Genuine different variants** | `BC-000007` | Organic India Ginger Fresh Sonth (500 g) | 500 g | Distinct pack sizes / variants (100 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india garl` | 7 | **1. Genuine different variants** | `BC-000008` | Organic India Garlic Desi (100 g) | 100 g | Distinct pack sizes / variants (100 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india cori` | 12 | **1. Genuine different variants** | `BC-000009` | Organic India Coriander Leaf Bundle (1 Bunch) | 1 bunch | Distinct pack sizes / variants (1 bunch, 2 bunches); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india pome` | 12 | **1. Genuine different variants** | `BC-000010` | Organic India Pomegranate Phule Arakta (2 kg) | 2 kg | Distinct pack sizes / variants (1 kg, 2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh guava maha` | 10 | **1. Genuine different variants** | `BC-000011` | Farm Fresh Guava Maharashtra Pink (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh pa` | 7 | **4. Same product with conflicting MRP** | `BC-000012` | Bhusawal Fresh Papaya Honey Sweet (1 pc (approx 1kg)) | 1 pc (approx 1kg | Same product variant listed with conflicting MRPs (₹95.0, ₹100.0, ₹116.0, ₹128.0) |
| `mahafresh :: mahafresh orange nagpu` | 14 | **1. Genuine different variants** | `BC-000013` | Mahafresh Orange Nagpur Juicym (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 2 kg); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh ap` | 13 | **1. Genuine different variants** | `BC-000014` | Bhusawal Fresh Apple Shimla Royal (2 kg) | 2 kg | Distinct pack sizes / variants (1 kg, 2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh le` | 9 | **1. Genuine different variants** | `BC-000015` | Bhusawal Fresh Lemon Nimbu Yellow (250 g) | 250 g | Distinct pack sizes / variants (250 g, 6 pcs); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh lady finge` | 12 | **1. Genuine different variants** | `BC-000016` | Farm Fresh Lady Finger Bhindi (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india brin` | 8 | **1. Genuine different variants** | `BC-000017` | Organic India Brinjal Black Beauty (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh cauliflower ` | 7 | **4. Same product with conflicting MRP** | `BC-000018` | Mahafresh Cauliflower Gobhi (2 pcs) | 2 pcs | Same product variant listed with conflicting MRPs (₹37.0, ₹53.0, ₹77.0, ₹79.0) |
| `mahafresh :: mahafresh cabbage gree` | 6 | **4. Same product with conflicting MRP** | `BC-000019` | Mahafresh Cabbage Green (2 pcs) | 2 pcs | Same product variant listed with conflicting MRPs (₹35.0, ₹37.0, ₹58.0, ₹63.0) |
| `organic india :: organic india spin` | 10 | **1. Genuine different variants** | `BC-000020` | Organic India Spinach Palak Leaf (1 Bunch) | 1 bunch | Distinct pack sizes / variants (1 bunch, 250 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh banana shr` | 8 | **4. Same product with conflicting MRP** | `BC-000022` | Farm Fresh Banana Shrimanti (1 kg) | 1 dozen | Same product variant listed with conflicting MRPs (₹52.0, ₹64.0, ₹82.0, ₹99.0) |
| `bhusawal fresh :: bhusawal fresh on` | 13 | **1. Genuine different variants** | `BC-000023` | Bhusawal Fresh Onion Nashik Red (2 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 5 kg); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh po` | 13 | **1. Genuine different variants** | `BC-000024` | Bhusawal Fresh Potato Indore Special (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 5 kg); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh to` | 15 | **1. Genuine different variants** | `BC-000025` | Bhusawal Fresh Tomato Hybrid Red (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh ginger fre` | 8 | **1. Genuine different variants** | `BC-000027` | Farm Fresh Ginger Fresh Sonth (100 g) | 100 g | Distinct pack sizes / variants (100 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh garlic des` | 11 | **1. Genuine different variants** | `BC-000028` | Farm Fresh Garlic Desi (100 g) | 100 g | Distinct pack sizes / variants (100 g, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh coriander le` | 8 | **1. Genuine different variants** | `BC-000029` | Mahafresh Coriander Leaf Bundle (1 Bunch) | 1 bunch | Distinct pack sizes / variants (1 bunch, 2 bunches); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh pomegranat` | 10 | **1. Genuine different variants** | `BC-000030` | Farm Fresh Pomegranate Phule Arakta (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india papa` | 7 | **4. Same product with conflicting MRP** | `BC-000032` | Organic India Papaya Honey Sweet (1 pc (approx 1kg)) | 1 pc (approx 1kg | Same product variant listed with conflicting MRPs (₹66.0, ₹80.0, ₹86.0, ₹105.0, ₹120.0) |
| `farm fresh :: farm fresh orange nag` | 7 | **1. Genuine different variants** | `BC-000033` | Farm Fresh Orange Nagpur Juicym (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 2 kg); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh apple shimla` | 9 | **1. Genuine different variants** | `BC-000034` | Mahafresh Apple Shimla Royal (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 2 kg); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh lemon nimbu ` | 10 | **1. Genuine different variants** | `BC-000035` | Mahafresh Lemon Nimbu Yellow (250 g) | 250 g | Distinct pack sizes / variants (250 g, 6 pcs); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh la` | 12 | **1. Genuine different variants** | `BC-000036` | Bhusawal Fresh Lady Finger Bhindi (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh brinjal blac` | 13 | **1. Genuine different variants** | `BC-000037` | Mahafresh Brinjal Black Beauty (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh cauliflowe` | 6 | **4. Same product with conflicting MRP** | `BC-000038` | Farm Fresh Cauliflower Gobhi (1 pc (500g)) | 1 pc | Same product variant listed with conflicting MRPs (₹57.0, ₹65.0, ₹69.0, ₹78.0) |
| `bhusawal fresh :: bhusawal fresh ca` | 5 | **4. Same product with conflicting MRP** | `BC-000039` | Bhusawal Fresh Cabbage Green (2 pcs) | 2 pcs | Same product variant listed with conflicting MRPs (₹44.0, ₹48.0, ₹49.0) |
| `organic india :: organic india bana` | 14 | **4. Same product with conflicting MRP** | `BC-000041` | Organic India Banana Robusta (500 g) | 1 dozen | Same product variant listed with conflicting MRPs (₹40.0, ₹48.0, ₹52.0, ₹56.0, ₹67.0, ₹86.0, ₹89.0) |
| `bhusawal fresh :: bhusawal fresh ba` | 12 | **4. Same product with conflicting MRP** | `BC-000042` | Bhusawal Fresh Banana Shrimanti (1 kg) | 1 dozen | Same product variant listed with conflicting MRPs (₹59.0, ₹82.0, ₹94.0, ₹97.0, ₹98.0, ₹99.0, ₹106.0) |
| `organic india :: organic india onio` | 11 | **1. Genuine different variants** | `BC-000043` | Organic India Onion Nashik Red (2 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 5 kg); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh gr` | 13 | **1. Genuine different variants** | `BC-000046` | Bhusawal Fresh Green Chilli Tikka (100 g) | 100 g | Distinct pack sizes / variants (100 g, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh gi` | 16 | **1. Genuine different variants** | `BC-000047` | Bhusawal Fresh Ginger Fresh Sonth (100 g) | 100 g | Distinct pack sizes / variants (100 g, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh ga` | 12 | **1. Genuine different variants** | `BC-000048` | Bhusawal Fresh Garlic Desi (250 g) | 250 g | Distinct pack sizes / variants (100 g, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh coriander ` | 11 | **1. Genuine different variants** | `BC-000049` | Farm Fresh Coriander Leaf Bundle (2 Bunches) | 2 bunches | Distinct pack sizes / variants (1 bunch, 2 bunches); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india guav` | 7 | **1. Genuine different variants** | `BC-000051` | Organic India Guava Maharashtra Pink (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh papaya honey` | 4 | **4. Same product with conflicting MRP** | `BC-000052` | Mahafresh Papaya Honey Sweet (2 pcs) | 2 pcs | Same product variant listed with conflicting MRPs (₹70.0, ₹112.0) |
| `organic india :: organic india oran` | 10 | **1. Genuine different variants** | `BC-000053` | Organic India Orange Nagpur Juicym (2 kg) | 2 kg | Distinct pack sizes / variants (1 kg, 2 kg); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh lady finger ` | 15 | **1. Genuine different variants** | `BC-000056` | Mahafresh Lady Finger Bhindi (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh cauliflowe` | 4 | **4. Same product with conflicting MRP** | `BC-000058` | Farm Fresh Cauliflower Gobhi (2 pcs) | 2 pcs | Same product variant listed with conflicting MRPs (₹37.0, ₹47.0) |
| `farm fresh :: farm fresh spinach pa` | 14 | **1. Genuine different variants** | `BC-000060` | Farm Fresh Spinach Palak Leaf (500 g) | 500 g | Distinct pack sizes / variants (1 bunch, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india bana` | 13 | **4. Same product with conflicting MRP** | `BC-000062` | Organic India Banana Shrimanti (1 kg) | 1 dozen | Same product variant listed with conflicting MRPs (₹61.0, ₹65.0, ₹66.0, ₹70.0, ₹74.0, ₹86.0, ₹92.0, ₹107.0) |
| `mahafresh :: mahafresh pomegranate ` | 13 | **1. Genuine different variants** | `BC-000070` | Mahafresh Pomegranate Phule Arakta (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh papaya honey` | 4 | **4. Same product with conflicting MRP** | `BC-000072` | Mahafresh Papaya Honey Sweet (1 pc (approx 1kg)) | 1 pc (approx 1kg | Same product variant listed with conflicting MRPs (₹88.0, ₹113.0) |
| `farm fresh :: farm fresh apple shim` | 10 | **1. Genuine different variants** | `BC-000074` | Farm Fresh Apple Shimla Royal (500 g) | 500 g | Distinct pack sizes / variants (2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh lemon nimb` | 12 | **1. Genuine different variants** | `BC-000075` | Farm Fresh Lemon Nimbu Yellow (250 g) | 250 g | Distinct pack sizes / variants (250 g, 6 pcs); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh br` | 10 | **1. Genuine different variants** | `BC-000077` | Bhusawal Fresh Brinjal Black Beauty (250 g) | 250 g | Distinct pack sizes / variants (1 kg, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh cabbage gree` | 8 | **4. Same product with conflicting MRP** | `BC-000079` | Mahafresh Cabbage Green (1 pc (600g)) | 1 pc | Same product variant listed with conflicting MRPs (₹32.0, ₹38.0, ₹46.0, ₹54.0, ₹63.0) |
| `mahafresh :: mahafresh onion nashik` | 10 | **1. Genuine different variants** | `BC-000083` | Mahafresh Onion Nashik Red (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 5 kg); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh tomato hyb` | 11 | **1. Genuine different variants** | `BC-000085` | Farm Fresh Tomato Hybrid Red (2 kg) | 2 kg | Distinct pack sizes / variants (1 kg, 2 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh co` | 14 | **1. Genuine different variants** | `BC-000089` | Bhusawal Fresh Coriander Leaf Bundle (500 g) | 1 bunch | Distinct pack sizes / variants (1 bunch, 2 bunches); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh gu` | 12 | **1. Genuine different variants** | `BC-000091` | Bhusawal Fresh Guava Maharashtra Pink (500 g) | 500 g | Distinct pack sizes / variants (1 kg, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india appl` | 8 | **1. Genuine different variants** | `BC-000094` | Organic India Apple Shimla Royal (2 kg) | 2 kg | Distinct pack sizes / variants (1 kg, 2 kg); KEEP ALL VARIANTS ACTIVE |
| `farm fresh :: farm fresh brinjal bl` | 11 | **1. Genuine different variants** | `BC-000097` | Farm Fresh Brinjal Black Beauty (1 kg) | 1 kg | Distinct pack sizes / variants (1 kg, 250 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india cabb` | 7 | **4. Same product with conflicting MRP** | `BC-000099` | Organic India Cabbage Green (1 pc (600g)) | 1 pc | Same product variant listed with conflicting MRPs (₹28.0, ₹42.0, ₹45.0, ₹52.0) |
| `mahafresh :: mahafresh spinach pala` | 10 | **1. Genuine different variants** | `BC-000100` | Mahafresh Spinach Palak Leaf (250 g) | 250 g | Distinct pack sizes / variants (1 bunch, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `bhusawal fresh :: bhusawal fresh ba` | 11 | **4. Same product with conflicting MRP** | `BC-000101` | Bhusawal Fresh Banana Robusta (1 Dozen) | 1 dozen | Same product variant listed with conflicting MRPs (₹41.0, ₹53.0, ₹56.0, ₹59.0, ₹97.0) |
| `mahafresh :: mahafresh green chilli` | 6 | **1. Genuine different variants** | `BC-000106` | Mahafresh Green Chilli Tikka (250 g) | 250 g | Distinct pack sizes / variants (100 g, 250 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh ginger fresh` | 8 | **1. Genuine different variants** | `BC-000107` | Mahafresh Ginger Fresh Sonth (500 g) | 500 g | Distinct pack sizes / variants (100 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `mahafresh :: mahafresh garlic desi` | 15 | **1. Genuine different variants** | `BC-000108` | Mahafresh Garlic Desi (250 g) | 250 g | Distinct pack sizes / variants (100 g, 250 g, 500 g); KEEP ALL VARIANTS ACTIVE |
| `organic india :: organic india caul` | 6 | **4. Same product with conflicting MRP** | `BC-000118` | Organic India Cauliflower Gobhi (2 pcs) | 2 pcs | Same product variant listed with conflicting MRPs (₹59.0, ₹60.0, ₹73.0, ₹76.0) |
| `bhusawal fresh :: bhusawal fresh sp` | 6 | **4. Same product with conflicting MRP** | `BC-000120` | Bhusawal Fresh Spinach Palak Leaf (250 g) | 250 g | Same product variant listed with conflicting MRPs (₹24.0, ₹38.0, ₹41.0, ₹44.0) |


*...Remaining 1400 duplicate groups logged in repair dataset...*


---

## 🛑 3. Safety & Data Integrity Verification

- **Total Genuine Product Variants Kept Active**: 11979 variant instances.
- **Total Canonical Records Selected**: 453 primary records.
- **Total Duplicate Records Safely Marked**: 1594 records marked with `duplicateOf`.
- **Data Deletion Status**: 0 records deleted. 100% data preserved.
- **Customer Display Names**: 100% UNCHANGED per prompt directive.
- **Original Catalog Backup**: Preserved in `backups/catalog_backup_20260808/`.

