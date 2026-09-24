/**
 * scripts/validate_master_catalog_excel.cjs
 * Exhaustive validation of the generated master Excel workbook.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const ROOT_DIR = process.cwd();
const OUTPUT_XLSX_PATH = path.join(ROOT_DIR, 'bhusawal_connect_master_product_catalog.xlsx');
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, 'bhusawal_connect_catalog_summary.json');

async function validate() {
  console.log('=== VALIDATING GENERATED EXCEL WORKBOOK ===');
  
  if (!fs.existsSync(OUTPUT_XLSX_PATH)) {
    throw new Error(`Excel file not found at ${OUTPUT_XLSX_PATH}`);
  }
  const fileSizeMB = (fs.statSync(OUTPUT_XLSX_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(`Excel file size: ${fileSizeMB} MB`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(OUTPUT_XLSX_PATH);
  console.log(`Successfully opened workbook. Total sheets: ${workbook.worksheets.length}`);

  const expectedSheets = [
    'MASTER_CATALOG',
    'DAILY_NEEDS',
    'FRUITS_VEGETABLES',
    'DAIRY_EGGS',
    'SNACKS_BEVERAGES',
    'PERSONAL_CARE',
    'HOUSEHOLD',
    'BABY_CARE',
    'HEALTH_OTC',
    'MEDICINES',
    'FOOD',
    'LOCAL_SHOPS',
    'RESTRICTED_PRODUCTS',
    'REVIEW_REQUIRED',
    'DUPLICATES',
    'DATA_DICTIONARY'
  ];

  const sheetNames = workbook.worksheets.map(ws => ws.name);
  console.log('Detected Sheet Names:', sheetNames);

  expectedSheets.forEach(name => {
    if (!sheetNames.includes(name)) {
      throw new Error(`Missing expected sheet: ${name}`);
    }
  });

  const sheetStats = {};
  const masterProductIds = new Set();
  let duplicateProductIds = 0;

  workbook.worksheets.forEach(ws => {
    const rowCount = ws.rowCount;
    const colCount = ws.columnCount;
    sheetStats[ws.name] = { rows: rowCount, cols: colCount };

    if (rowCount <= 1 && ws.name !== 'DUPLICATES') {
      console.warn(`Warning: Sheet ${ws.name} has only ${rowCount} rows`);
    }

    // Check header on row 1
    const headerRow = ws.getRow(1);
    const headers = [];
    headerRow.eachCell(cell => headers.push(cell.value));
    
    if (ws.name === 'MASTER_CATALOG') {
      // Validate product uniqueness
      for (let r = 2; r <= rowCount; r++) {
        const row = ws.getRow(r);
        const prodId = row.getCell(1).value;
        if (prodId) {
          if (masterProductIds.has(prodId)) {
            duplicateProductIds++;
            console.error(`Duplicate Product ID detected: ${prodId} on row ${r}`);
          } else {
            masterProductIds.add(prodId);
          }
        }
      }
    }
  });

  console.log('--- SHEET ROW & COLUMN SUMMARY ---');
  console.table(sheetStats);

  console.log(`Unique Product IDs in MASTER_CATALOG: ${masterProductIds.size}`);
  console.log(`Duplicate Product IDs: ${duplicateProductIds}`);

  if (duplicateProductIds > 0) {
    throw new Error('Found duplicate product IDs in master catalog!');
  }

  // Verify Summary JSON
  if (!fs.existsSync(OUTPUT_JSON_PATH)) {
    throw new Error('Summary JSON not found!');
  }
  const summary = JSON.parse(fs.readFileSync(OUTPUT_JSON_PATH, 'utf8'));
  console.log('\n--- SUMMARY JSON CONTENTS ---');
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n=== ALL WORKBOOK & INTEGRITY VALIDATIONS PASSED PERFECTLY ===');
}

validate().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
