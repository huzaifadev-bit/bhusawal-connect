# 🚀 Bhusawal Connect — Natural Language Google Sheets, Drive & Colab Integration Guide

Complete end-to-end guide for controlling the **Google Colab Processing Worker** directly via **Natural Language Prompts** in **Antigravity**.

---

## 🏗️ Workflow & Architecture

```
USER
  │  (Natural Language Prompt: "Process 50 products.")
  ▼
ANTIGRAVITY NATURAL LANGUAGE DISPATCHER
  │  (Translates intent -> Dispatches Job with Status: QUEUED)
  ▼
GOOGLE SHEETS / DRIVE QUEUE
  │  ├── 📑 Product_Catalogue (7 Standardized Fields)
  │  ├── 📑 _Jobs_Queue (14 Tracking Fields)
  │  └── 📑 _Job_Logs (Realtime Item-Level Logs)
  ▼
GOOGLE COLAB WORKER (GPU / Cloud Background Daemon)
  │  ├── 1. Claims QUEUED job -> Status: RUNNING
  │  ├── 2. Reads Product Name, Brand, Quantity, MRP
  │  ├── 3. Synthesizes commercial studio packaging photography
  │  ├── 4. Saves .jpg to Drive (product-name_brand_quantity_mrp.jpg)
  │  ├── 5. Updates Sheet: Image URL, Image File, Status = VERIFIED
  │  ├── 6. Streams live progress % & counters to _Job_Logs
  │  └── 7. Sets Job Status: COMPLETED
  ▼
ANTIGRAVITY RESULT & STATUS REPORT
```

---

## 🔒 Security & Environment Configuration

All credentials and secrets are loaded from `.env` and are never committed to Git:

### 1. Environment Variables in `.env`
```bash
# Google Cloud API Key
GOOGLE_API_KEY=AIzaSy...

# Target Google Sheet ID (Private Sheet)
GOOGLE_SHEET_ID=1CdU03pY_tAUTXND4NH8KI2siE6gcR2XqOPgBkaQCHVY

# Target Google Drive Folder ID
GOOGLE_DRIVE_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
```

> [!NOTE]
> `.env`, `credentials/`, `*service_account*.json`, `token.json`, and `.jobs/` are strictly ignored in `.gitignore`.

---

## 📊 Standardized 7 Product Catalogue Fields

| Column | Field Name | Allowed Values / Description | Example |
| :---: | :--- | :--- | :--- |
| **A** | `Product Name` | Commercial product title | `Madhur Pure & Hygienic Sugar` |
| **B** | `Brand` | Manufacturer / Brand name | `Madhur` |
| **C** | `Quantity` | Standard pack size / unit | `1 kg` |
| **D** | `MRP` | Maximum Retail Price | `₹60` |
| **E** | `Image URL` | Direct viewable / CDN image URL | `https://image.pollinations.ai/...` |
| **F** | `Image File` | Deterministic filename in Drive | `madhur_pure_hygienic_sugar_madhur_1_kg_60.jpg` |
| **G** | `Image Verification Status` | `VERIFIED`, `PENDING_GENERATION`, `REJECTED` | `VERIFIED` |

---

## 📋 Standardized 14 Job Queue Fields

The `_Jobs_Queue` tab in Google Sheets tracks every job with 14 standardized columns:
1. `Job ID` (e.g. `JOB-20260915-3CC95B`)
2. `Task` (`PROCESS_CATALOG`, `GENERATE_PRODUCT_IMAGES`, `VERIFY_PRODUCT_IMAGES`, `UPDATE_CATALOG`, `SYNC_RESULTS`)
3. `Created At` (ISO timestamp)
4. `Status` (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`)
5. `Progress` (`0%` to `100%`)
6. `Total Items` (e.g. `50`)
7. `Completed Items` (e.g. `50`)
8. `Failed Items` (e.g. `0`)
9. `Pending Items` (e.g. `0`)
10. `Current Product` (Name of item actively processing)
11. `Error` (Error description if failed)
12. `Started At` (ISO timestamp)
13. `Completed At` (ISO timestamp)
14. `Summary` (Execution summary)

---

## 💬 Natural Language Commands in Antigravity

You can control the entire system using plain English prompts:

| Natural Language Prompt | What Antigravity Does |
| :--- | :--- |
| `"Process 50 products."` | Dispatches `PROCESS_CATALOG` job for 50 items |
| `"Generate images for all products without images."` | Dispatches `GENERATE_PRODUCT_IMAGES` for unverified/missing items |
| `"Verify the existing product images."` | Dispatches `VERIFY_PRODUCT_IMAGES` audit batch |
| `"Process products 1 to 100."` | Dispatches `PROCESS_CATALOG` for items 1 through 100 |
| `"Process all unverified products."` | Dispatches `PROCESS_CATALOG` targeting only pending rows |
| `"Regenerate rejected images."` | Dispatches `GENERATE_PRODUCT_IMAGES` targeting `REJECTED` rows |
| `"Show me the current Colab job."` | Fetches active/latest job status and prints live progress report |
| `"Cancel the current job."` | Sets active job status to `CANCELLED` |
| `"Resume the failed job."` | Resets failed job to `QUEUED` for Colab to re-process |

---

## ⚡ Starting the Colab Worker (1-Click)

1. Open [Google Colab](https://colab.research.google.com).
2. Upload `colab/bhusawal_connect_colab_worker.ipynb`.
3. Run the cells in order:
   - **Cell 1**: Installs dependencies (`gspread`, `google-auth`, `Pillow`, `requests`).
   - **Cell 2**: Authenticates via `auth.authenticate_user()` (choose your Google account).
   - **Cell 3**: Pre-filled with `GOOGLE_SHEET_ID = "1CdU03pY_tAUTXND4NH8KI2siE6gcR2XqOPgBkaQCHVY"`.
   - **Cell 4**: Loads the Worker Engine.
   - **Cell 5**: Starts the Worker Loop.

The Colab worker displays:
```text
========================================
Bhusawal Connect Colab Worker
========================================
Authenticated: YES
Google Drive: CONNECTED
Google Sheets: CONNECTED (Bhusawal_Connect_Master_Catalogue)
Worker: RUNNING

Waiting for jobs...
```

---

## 🧪 5-Product End-to-End Acceptance Test

Run the built-in automated test anytime to verify all 12 steps:
```bash
node scripts/colab_bridge/run_5_product_e2e_test.js
```

Test Results:
- ✅ Antigravity parsed prompt and created `QUEUED` job.
- ✅ Worker claimed job and transitioned status to `RUNNING`.
- ✅ Synthesized commercial studio packaging for 5 products.
- ✅ Saved images to Drive with deterministic names (`product-name_brand_quantity_mrp.jpg`).
- ✅ Verified image quality and updated `Image Verification Status = VERIFIED`.
- ✅ Completed job with 5/5 successful and 0 failed.
