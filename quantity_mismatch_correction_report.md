# 📏 Product Quantity & Weight Alignment Report

### 📊 Verification Metrics

- **Total Audited Items**: `8269`
- **Verified Compliant Items**: `6060`
- **Auto-Corrected Quantity Mismatches**: `2209`
- **Flagged Cases Logged for Manual Review**: `2178`

---

### 🔧 Auto-Correction Logic Applied

When the **Product Name** explicitly contains a size/volume specification (e.g. *Maaza 2L*), the internal `weight`, `pack`, and `Pack Size` fields are strictly aligned to match the displayed product name.

- **Rule 1**: Prevented cross-size mismatches (e.g., *Maaza 2L* with `weight: 250ml` $\rightarrow$ corrected to `2L`).
- **Rule 2**: Populated missing weight/volume attributes from explicit name descriptors.
- **Rule 3**: Updated `grocery_catalog.json`, `food_catalog.json`, and `grouped_grocery_catalog.json`.

---

### ⚠️ Sample Auto-Corrected Product Mismatches

| SKU | Product Name | Original Weight Field | Corrected Aligned Weight | Status |
|---|---|---|---|---|
| `BC-000012` | Bhusawal Fresh Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000032` | Organic India Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000038` | Farm Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000072` | Mahafresh Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000079` | Mahafresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000092` | Bhusawal Fresh Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000099` | Organic India Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000112` | Organic India Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000119` | Mahafresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000138` | Bhusawal Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000139` | Organic India Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000159` | Farm Fresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000172` | Organic India Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000178` | Mahafresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000192` | Bhusawal Fresh Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000198` | Farm Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000212` | Organic India Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000219` | Farm Fresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000252` | Bhusawal Fresh Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000259` | Organic India Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000278` | Farm Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000279` | Organic India Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000292` | Organic India Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000298` | Farm Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000299` | Mahafresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000332` | Bhusawal Fresh Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000338` | Bhusawal Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000339` | Mahafresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000358` | Bhusawal Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000359` | Mahafresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000398` | Mahafresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000399` | Mahafresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000418` | Bhusawal Fresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000419` | Farm Fresh Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000432` | Mahafresh Papaya Honey Sweet (1 pc (approx 1kg)) | `1 pc (approx 1kg)` | **`1kg`** | ✅ Aligned |
| `BC-000438` | Mahafresh Cauliflower Gobhi (1 pc (500g)) | `1 pc (500g)` | **`500g`** | ✅ Aligned |
| `BC-000439` | Organic India Cabbage Green (1 pc (600g)) | `1 pc (600g)` | **`600g`** | ✅ Aligned |
| `BC-000456` | Slurrp Farm Processed Cheese Slices (200 g (10 Slices)) | `200 g (10 Slices)` | **`200 g`** | ✅ Aligned |
| `BC-000470` | Mother Dairy Processed Cheese Slices (100 g (5 Slices)) | `100 g (5 Slices)` | **`100 g`** | ✅ Aligned |
| `BC-000484` | Mother Dairy Processed Cheese Slices (200 g (10 Slices)) | `200 g (10 Slices)` | **`200 g`** | ✅ Aligned |
| `BC-000498` | Slurrp Farm Processed Cheese Slices (200 g (10 Slices)) | `200 g (10 Slices)` | **`200 g`** | ✅ Aligned |
| `BC-000512` | Gowardhan Processed Cheese Slices (100 g (5 Slices)) | `100 g (5 Slices)` | **`100 g`** | ✅ Aligned |
| `BC-000526` | Chitale Processed Cheese Slices (200 g (10 Slices)) | `200 g (10 Slices)` | **`200 g`** | ✅ Aligned |
| `BC-000540` | Slurrp Farm Processed Cheese Slices (100 g (5 Slices)) | `100 g (5 Slices)` | **`100 g`** | ✅ Aligned |
| `BC-000554` | Gowardhan Processed Cheese Slices (100 g (5 Slices)) | `100 g (5 Slices)` | **`100 g`** | ✅ Aligned |
| `BC-000568` | Slurrp Farm Processed Cheese Slices (100 g (5 Slices)) | `100 g (5 Slices)` | **`100 g`** | ✅ Aligned |
| `BC-000582` | Amul Processed Cheese Slices (100 g (5 Slices)) | `100 g (5 Slices)` | **`100 g`** | ✅ Aligned |
| `BC-000596` | Slurrp Farm Processed Cheese Slices (200 g (10 Slices)) | `200 g (10 Slices)` | **`200 g`** | ✅ Aligned |
| `BC-000610` | Quaker Processed Cheese Slices (200 g (10 Slices)) | `200 g (10 Slices)` | **`200 g`** | ✅ Aligned |
| `BC-000624` | Gowardhan Processed Cheese Slices (100 g (5 Slices)) | `100 g (5 Slices)` | **`100 g`** | ✅ Aligned |

*... and 2128 more aligned items.*
