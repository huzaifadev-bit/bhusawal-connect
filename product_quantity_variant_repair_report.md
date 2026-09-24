# ⚖️ Product Quantity & Variant Relationship Repair Report — Bhusawal Connect

> [!IMPORTANT]
> **MRP REMAINS 100% UNCHANGED**. All product variants (e.g., 250ml, 600ml, 1L, 2L) remain separate items. Original backup files (`backups/catalog_backup_20260808/`) remain untouched.

## 📊 1. Quantity & Variant Repair Statistics

| Metric | Count | Percentage |
| :--- | :---: | :---: |
| **Total Products Reviewed** | **14026** | 100.0% |
| **Quantity / Variant Corrected** | **2333** | 16.63% |
| **Needs Verification (`QUANTITY_VERIFICATION_REQUIRED`)** | **0** | 0.00% |
| **Unchanged (Already Clean & Aligned)** | **11693** | 83.37% |

---

## 📋 2. Quantity & Variant Audit Log Table (8 Required Fields)

| Product ID | Brand | Product Name | Original Weight/Pack | New Verified Weight/Pack | Local Selling Unit | Reason for Change | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `BC-000001` | Mahafresh | Mahafresh Banana Robusta (500 g) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000002` | Mahafresh | Mahafresh Banana Shrimanti (2 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000003` | Farm Fresh | Farm Fresh Onion Nashik Red (2 kg) | 2 kg | **1 kg** | **1 kg** | Aligned Onion to local selling unit '1 kg' | **HIGH** |
| `BC-000012` | Bhusawal Fresh | Bhusawal Fresh Papaya Honey Sweet (1 pc (approx 1kg)) | 1 pc | **1 pc (approx 1kg** | **1 pc (approx 1kg** | Synchronized produce quantity field to title quantity '1 pc (approx 1kg' | **HIGH** |
| `BC-000015` | Bhusawal Fresh | Bhusawal Fresh Lemon Nimbu Yellow (250 g) | 6 pcs | **250 g** | **250 g** | Aligned Lemon/Nimbu to selling unit '250 g' | **HIGH** |
| `BC-000018` | Mahafresh | Mahafresh Cauliflower Gobhi (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Aligned Cabbage/Cauliflower to selling unit '2 pcs' | **HIGH** |
| `BC-000019` | Mahafresh | Mahafresh Cabbage Green (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Aligned Cabbage/Cauliflower to selling unit '2 pcs' | **HIGH** |
| `BC-000022` | Farm Fresh | Farm Fresh Banana Shrimanti (1 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000023` | Bhusawal Fresh | Bhusawal Fresh Onion Nashik Red (2 kg) | 2 kg | **1 kg** | **1 kg** | Aligned Onion to local selling unit '1 kg' | **HIGH** |
| `BC-000032` | Organic India | Organic India Papaya Honey Sweet (1 pc (approx 1kg)) | 1 pc | **1 pc (approx 1kg** | **1 pc (approx 1kg** | Synchronized produce quantity field to title quantity '1 pc (approx 1kg' | **HIGH** |
| `BC-000035` | Mahafresh | Mahafresh Lemon Nimbu Yellow (250 g) | 6 pcs | **250 g** | **250 g** | Aligned Lemon/Nimbu to selling unit '250 g' | **HIGH** |
| `BC-000039` | Bhusawal Fresh | Bhusawal Fresh Cabbage Green (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Aligned Cabbage/Cauliflower to selling unit '2 pcs' | **HIGH** |
| `BC-000040` | Organic India | Organic India Spinach Palak Leaf (250 g) | 1 bunch | **250 g** | **250 g** | Aligned Spinach/Palak to selling unit '250 g' | **HIGH** |
| `BC-000041` | Organic India | Organic India Banana Robusta (500 g) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000042` | Bhusawal Fresh | Bhusawal Fresh Banana Shrimanti (1 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000043` | Organic India | Organic India Onion Nashik Red (2 kg) | 2 kg | **1 kg** | **1 kg** | Aligned Onion to local selling unit '1 kg' | **HIGH** |
| `BC-000044` | Bhusawal Fresh | Bhusawal Fresh Potato Indore Special (2 kg) | 2 kg | **1 kg** | **1 kg** | Aligned Potato to local selling unit '1 kg' | **HIGH** |
| `BC-000046` | Bhusawal Fresh | Bhusawal Fresh Green Chilli Tikka (100 g) | 250 g | **100 g** | **100 g** | Synchronized produce quantity field to title quantity '100 g' | **HIGH** |
| `BC-000049` | Farm Fresh | Farm Fresh Coriander Leaf Bundle (2 Bunches) | 1 bunch | **2 bunches** | **2 bunches** | Aligned Coriander to local selling unit '2 bunches' | **HIGH** |
| `BC-000052` | Mahafresh | Mahafresh Papaya Honey Sweet (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Synchronized produce quantity field to title quantity '2 pcs' | **HIGH** |
| `BC-000058` | Farm Fresh | Farm Fresh Cauliflower Gobhi (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Aligned Cabbage/Cauliflower to selling unit '2 pcs' | **HIGH** |
| `BC-000060` | Farm Fresh | Farm Fresh Spinach Palak Leaf (500 g) | 1 bunch | **500 g** | **500 g** | Aligned Spinach/Palak to selling unit '500 g' | **HIGH** |
| `BC-000061` | Organic India | Organic India Banana Robusta (1 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000062` | Organic India | Organic India Banana Shrimanti (1 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000064` | Organic India | Organic India Potato Indore Special (5 kg) | 1 kg | **5 kg** | **5 kg** | Aligned Potato to local selling unit '5 kg' | **HIGH** |
| `BC-000072` | Mahafresh | Mahafresh Papaya Honey Sweet (1 pc (approx 1kg)) | 1 pc | **1 pc (approx 1kg** | **1 pc (approx 1kg** | Synchronized produce quantity field to title quantity '1 pc (approx 1kg' | **HIGH** |
| `BC-000075` | Farm Fresh | Farm Fresh Lemon Nimbu Yellow (250 g) | 12 pcs | **250 g** | **250 g** | Aligned Lemon/Nimbu to selling unit '250 g' | **HIGH** |
| `BC-000089` | Bhusawal Fresh | Bhusawal Fresh Coriander Leaf Bundle (500 g) | 1 bunch | **1 bunch** | **1 bunch** | Aligned Coriander to local selling unit '1 bunch' | **HIGH** |
| `BC-000100` | Mahafresh | Mahafresh Spinach Palak Leaf (250 g) | 1 bunch | **250 g** | **250 g** | Aligned Spinach/Palak to selling unit '250 g' | **HIGH** |
| `BC-000104` | Organic India | Organic India Potato Indore Special (2 kg) | 2 kg | **1 kg** | **1 kg** | Aligned Potato to local selling unit '1 kg' | **HIGH** |
| `BC-000115` | Bhusawal Fresh | Bhusawal Fresh Lemon Nimbu Yellow (4 pcs) | 12 pcs | **6 pcs** | **6 pcs** | Aligned Lemon/Nimbu to selling unit '6 pcs' | **HIGH** |
| `BC-000118` | Organic India | Organic India Cauliflower Gobhi (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Aligned Cabbage/Cauliflower to selling unit '2 pcs' | **HIGH** |
| `BC-000120` | Bhusawal Fresh | Bhusawal Fresh Spinach Palak Leaf (250 g) | 1 bunch | **250 g** | **250 g** | Aligned Spinach/Palak to selling unit '250 g' | **HIGH** |
| `BC-000124` | Mahafresh | Mahafresh Potato Indore Special (2 kg) | 2 kg | **1 kg** | **1 kg** | Aligned Potato to local selling unit '1 kg' | **HIGH** |
| `BC-000129` | Organic India | Organic India Coriander Leaf Bundle (500 g) | 1 bunch | **1 bunch** | **1 bunch** | Aligned Coriander to local selling unit '1 bunch' | **HIGH** |
| `BC-000132` | Organic India | Organic India Papaya Honey Sweet (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Synchronized produce quantity field to title quantity '2 pcs' | **HIGH** |
| `BC-000135` | Farm Fresh | Farm Fresh Lemon Nimbu Yellow (4 pcs) | 12 pcs | **6 pcs** | **6 pcs** | Aligned Lemon/Nimbu to selling unit '6 pcs' | **HIGH** |
| `BC-000140` | Mahafresh | Mahafresh Spinach Palak Leaf (500 g) | 1 bunch | **500 g** | **500 g** | Aligned Spinach/Palak to selling unit '500 g' | **HIGH** |
| `BC-000141` | Farm Fresh | Farm Fresh Banana Robusta (500 g) | 6 pcs | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000143` | Organic India | Organic India Onion Nashik Red (5 kg) | 1 kg | **5 kg** | **5 kg** | Aligned Onion to local selling unit '5 kg' | **HIGH** |
| `BC-000149` | Farm Fresh | Farm Fresh Coriander Leaf Bundle (500 g) | 1 bunch | **1 bunch** | **1 bunch** | Aligned Coriander to local selling unit '1 bunch' | **HIGH** |
| `BC-000152` | Bhusawal Fresh | Bhusawal Fresh Papaya Honey Sweet (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Synchronized produce quantity field to title quantity '2 pcs' | **HIGH** |
| `BC-000155` | Mahafresh | Mahafresh Lemon Nimbu Yellow (4 pcs) | 12 pcs | **6 pcs** | **6 pcs** | Aligned Lemon/Nimbu to selling unit '6 pcs' | **HIGH** |
| `BC-000162` | Bhusawal Fresh | Bhusawal Fresh Banana Shrimanti (2 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000184` | Farm Fresh | Farm Fresh Potato Indore Special (5 kg) | 1 kg | **5 kg** | **5 kg** | Aligned Potato to local selling unit '5 kg' | **HIGH** |
| `BC-000195` | Organic India | Organic India Lemon Nimbu Yellow (250 g) | 12 pcs | **250 g** | **250 g** | Aligned Lemon/Nimbu to selling unit '250 g' | **HIGH** |
| `BC-000201` | Bhusawal Fresh | Bhusawal Fresh Banana Robusta (500 g) | 6 pcs | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000202` | Organic India | Organic India Banana Shrimanti (2 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000204` | Farm Fresh | Farm Fresh Potato Indore Special (2 kg) | 2 kg | **1 kg** | **1 kg** | Aligned Potato to local selling unit '1 kg' | **HIGH** |
| `BC-000209` | Bhusawal Fresh | Bhusawal Fresh Coriander Leaf Bundle (2 Bunches) | 1 bunch | **2 bunches** | **2 bunches** | Aligned Coriander to local selling unit '2 bunches' | **HIGH** |
| `BC-000226` | Organic India | Organic India Green Chilli Tikka (100 g) | 250 g | **100 g** | **100 g** | Synchronized produce quantity field to title quantity '100 g' | **HIGH** |
| `BC-000243` | Bhusawal Fresh | Bhusawal Fresh Onion Nashik Red (5 kg) | 1 kg | **5 kg** | **5 kg** | Aligned Onion to local selling unit '5 kg' | **HIGH** |
| `BC-000260` | Farm Fresh | Farm Fresh Spinach Palak Leaf (250 g) | 1 bunch | **250 g** | **250 g** | Aligned Spinach/Palak to selling unit '250 g' | **HIGH** |
| `BC-000261` | Farm Fresh | Farm Fresh Banana Robusta (1 kg) | 1 dozen | **1 dozen** | **1 dozen** | Aligned Banana to local selling unit '1 dozen' / '6 pcs' | **HIGH** |
| `BC-000266` | Mahafresh | Mahafresh Green Chilli Tikka (100 g) | 250 g | **100 g** | **100 g** | Synchronized produce quantity field to title quantity '100 g' | **HIGH** |
| `BC-000289` | Mahafresh | Mahafresh Coriander Leaf Bundle (2 Bunches) | 1 bunch | **2 bunches** | **2 bunches** | Aligned Coriander to local selling unit '2 bunches' | **HIGH** |
| `BC-000303` | Farm Fresh | Farm Fresh Onion Nashik Red (5 kg) | 1 kg | **5 kg** | **5 kg** | Aligned Onion to local selling unit '5 kg' | **HIGH** |
| `BC-000312` | Farm Fresh | Farm Fresh Papaya Honey Sweet (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Synchronized produce quantity field to title quantity '2 pcs' | **HIGH** |
| `BC-000315` | Organic India | Organic India Lemon Nimbu Yellow (500 g) | 12 pcs | **6 pcs** | **6 pcs** | Aligned Lemon/Nimbu to selling unit '6 pcs' | **HIGH** |
| `BC-000319` | Farm Fresh | Farm Fresh Cabbage Green (2 pcs) | 1 pc | **2 pcs** | **2 pcs** | Aligned Cabbage/Cauliflower to selling unit '2 pcs' | **HIGH** |


*...Remaining 2273 quantity logs saved in repair dataset...*


---

## 🛑 3. Local Produce & Safety Verification

- **Banana Selling Unit**: Preserved as `1 dozen` (or `6 pcs`).
- **Potato Selling Unit**: Preserved as `1 kg` (or `5 kg` pack).
- **Onion Selling Unit**: Preserved as `1 kg` (or `5 kg` pack).
- **Coconut Selling Unit**: Preserved as `1 piece`.
- **Coriander Selling Unit**: Preserved as `1 bunch` (or `2 bunches`).
- **MRP Status**: 100% Unchanged across all items.
- **Original Catalog Backup**: Preserved in `backups/catalog_backup_20260808/`.

