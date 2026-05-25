const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { sqliteQuery, sqliteDb } = require('../db');

// Setup multer for memory storage uploads
const upload = multer({ storage: multer.memoryStorage() });

// Helper: Parse sheet name to determine Month, Year and Fiscal Year
// e.g. "ต.ค.68" -> Month: "ต.ค.", Year: 2568, Fiscal Year: 2569 (Thai FY is Oct - Sep)
function parseThaiSheetName(sheetName) {
  const cleanName = sheetName.trim();
  
  // Extract year from the end (2 to 4 digits), allowing spaces or underscores before it
  const match = cleanName.match(/(.+?)[\s_]*(\d{2,4})$/);
  if (!match) return null;

  let rawMonth = match[1].replace(/[\s\.]/g, ''); // Remove spaces and dots
  let yearShort = parseInt(match[2]);
  let yearFull = yearShort < 100 ? yearShort + 2500 : yearShort;

  let monthAbbr = "";
  if (rawMonth.includes("ตค") || rawMonth.includes("ตุลา")) monthAbbr = "ต.ค.";
  else if (rawMonth.includes("พย") || rawMonth.includes("พฤศจิ")) monthAbbr = "พ.ย.";
  else if (rawMonth.includes("ธค") || rawMonth.includes("ธันวา")) monthAbbr = "ธ.ค.";
  else if (rawMonth.includes("มค") || rawMonth.includes("มกรา")) monthAbbr = "ม.ค.";
  else if (rawMonth.includes("กพ") || rawMonth.includes("กุมภา")) monthAbbr = "ก.พ.";
  else if (rawMonth.includes("มีค") || rawMonth.includes("มีนา")) monthAbbr = "มี.ค.";
  else if (rawMonth.includes("เมย") || rawMonth.includes("เมษา")) monthAbbr = "เม.ย.";
  else if (rawMonth.includes("พค") || rawMonth.includes("พฤษภา")) monthAbbr = "พ.ค.";
  else if (rawMonth.includes("มิย") || rawMonth.includes("มิถุนา")) monthAbbr = "มิ.ย.";
  else if (rawMonth.includes("กค") || rawMonth.includes("กรกฎา")) monthAbbr = "ก.ค.";
  else if (rawMonth.includes("สค") || rawMonth.includes("สิงหา")) monthAbbr = "ส.ค.";
  else if (rawMonth.includes("กย") || rawMonth.includes("กันยา")) monthAbbr = "ก.ย.";
  else return null;

  // Thai Fiscal Year: October, November, December of Year N belong to Fiscal Year N + 1
  const isEndMonths = ["ต.ค.", "พ.ย.", "ธ.ค."].includes(monthAbbr);
  const fiscalYear = isEndMonths ? yearFull + 1 : yearFull;

  return {
    month_name: `${monthAbbr}${yearShort < 100 ? yearShort : yearShort - 2500}`,
    month_abbr: monthAbbr,
    year: yearFull,
    fiscal_year: fiscalYear
  };
}

// 1. Get inventory items list for a specific month
router.get('/items', async (req, res) => {
  try {
    const { year, month } = req.query; // e.g. year: 2569, month: "ต.ค.68"
    if (!year || !month) {
      return res.status(400).json({ error: "Missing year or month parameters." });
    }

    // Try to get data for this month
    let items = await getMonthlyInventoryFromDb(year, month);
    
    // If empty, look if we can initialize this month by carrying over from the previous month
    if (items.length === 0) {
      const carriedOver = await attemptCarryOver(parseInt(year), month);
      if (carriedOver) {
        items = await getMonthlyInventoryFromDb(year, month);
      }
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Get monthly inventory rows
async function getMonthlyInventoryFromDb(fiscalYear, monthName) {
  const sql = `
    SELECT 
      i.id as item_id,
      i.name,
      i.unit,
      i.pack_size,
      i.unit_price,
      i.min_stock,
      s.beginning_balance,
      s.received_qty,
      s.received_value,
      s.dispensed_qty,
      s.dispensed_value,
      s.remaining_qty,
      s.remaining_value,
      s.expiry_date
    FROM non_drug_items i
    INNER JOIN non_drug_monthly_stock s ON i.id = s.item_id
    WHERE s.fiscal_year = ? AND s.month_name = ?
    ORDER BY i.name ASC
  `;
  return await sqliteQuery.all(sql, [fiscalYear, monthName]);
}

// Helper: Attempt to carry over stock from previous month
async function attemptCarryOver(fiscalYear, monthName) {
  const parsed = parseThaiSheetName(monthName);
  if (!parsed) return false;

  // List of months order in Thai fiscal year (Oct to Sep)
  const monthsOrder = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."];
  const idx = monthsOrder.indexOf(parsed.month_abbr);
  if (idx === -1) return false;

  let prevMonthAbbr = "";
  let prevYear = parsed.year;
  let prevFiscalYear = fiscalYear;

  if (idx === 0) {
    // Current is Oct (start of FY). Previous is Sep of previous year
    prevMonthAbbr = "ก.ย.";
    prevYear = parsed.year - 1;
    prevFiscalYear = fiscalYear - 1;
  } else {
    prevMonthAbbr = monthsOrder[idx - 1];
    // Dec -> Jan transition
    if (prevMonthAbbr === "ธ.ค.") {
      prevYear = parsed.year - 1;
    }
  }

  const prevMonthName = `${prevMonthAbbr}${String(prevYear).substring(2)}`;

  // Find if previous month has stock records
  const prevItems = await getMonthlyInventoryFromDb(prevFiscalYear, prevMonthName);
  if (prevItems.length === 0) return false;

  console.log(`Carrying over stock from ${prevMonthName} to ${monthName}...`);

  // Insert carried over values for this month
  for (const prev of prevItems) {
    // Check if stock record already exists to avoid unique constraint violations
    const checkSql = `SELECT id FROM non_drug_monthly_stock WHERE item_id = ? AND fiscal_year = ? AND month_name = ?`;
    const check = await sqliteQuery.get(checkSql, [prev.item_id, fiscalYear, monthName]);
    
    if (!check) {
      const insertSql = `
        INSERT INTO non_drug_monthly_stock 
        (item_id, fiscal_year, month_name, beginning_balance, remaining_qty, remaining_value, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      // Remaining qty from previous month becomes beginning balance for current month
      const remQty = prev.remaining_qty || 0;
      const remVal = remQty * (prev.unit_price || 0);
      await sqliteQuery.run(insertSql, [
        prev.item_id,
        fiscalYear,
        monthName,
        remQty, // beginning balance
        remQty, // initial remaining qty
        remVal, // initial remaining value
        prev.expiry_date
      ]);
    }
  }
  return true;
}

// 2. Import Excel inventory (supports multiple sheets or single sheet uploads)
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No Excel file uploaded." });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const importResults = [];

    // Process each sheet (representing a month)
    for (const sheetName of workbook.SheetNames) {
      const parsedInfo = parseThaiSheetName(sheetName);
      if (!parsedInfo) {
        console.log(`Skipping non-inventory sheet name: ${sheetName}`);
        continue; // Skip sheets that are not named like Thai month formats
      }

      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rawData.length < 3) continue;

      // Find header row (usually contains 'รายการยา', 'รายการ' or 'ยอดยกมา')
      let headerRowIndex = -1;
      for (let r = 0; r < Math.min(10, rawData.length); r++) {
        const row = rawData[r];
        if (row && row.some(cell => typeof cell === 'string' && (cell.includes('รายการยา') || cell.includes('รายการ') || cell.includes('ยอดยกมา')))) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1) {
        console.warn(`Could not find header row in sheet: ${sheetName}`);
        continue;
      }

      const headerRow = rawData[headerRowIndex];
      
      // Determine index mapping based on column headers
      const colMap = {
        name: headerRow.findIndex(c => typeof c === 'string' && (c.includes('รายการยา') || c.includes('รายการ') || c.includes('ชื่อ'))),
        unit: headerRow.findIndex(c => typeof c === 'string' && (c.includes('หน่วยนับ') || c.includes('ประเภทยา') || c.includes('หน่วย'))),
        pack: headerRow.findIndex(c => typeof c === 'string' && c.includes('ขนาดบรรจุ')),
        price: headerRow.findIndex(c => typeof c === 'string' && (c.includes('ราคา/หน่วย') || c.includes('ราคาต่อหน่วย') || c.includes('ราคา'))),
        begin: headerRow.findIndex(c => typeof c === 'string' && (c.includes('ยอดยกมา') || c.includes('ยกมา') || c.includes('ยอดยก'))),
        recv: headerRow.findIndex(c => typeof c === 'string' && (c.includes('รับเข้าใหม่') || c.includes('รับเพิ่ม') || c.includes('รับเข้า') || c.includes('จำนวนรับ') || c === 'รับ')),
        disp: headerRow.findIndex(c => typeof c === 'string' && (c.includes('จ่ายออก') || c.includes('จ่าย') || c.includes('เบิก') || c.includes('จำนวนจ่าย'))),
        rem: headerRow.findIndex(c => typeof c === 'string' && (c.includes('คงเหลือ') || c.includes('ยอดเหลือ') || c.includes('เหลือ'))),
        expiry: headerRow.findIndex(c => typeof c === 'string' && (c.includes('วันหมดอายุ') || c.includes('หมดอายุ') || c.includes('exp')))
      };

      // Fallbacks for default structures if columns are not found by title matching
      // We will only fallback if the index is -1.
      // Assuming typical format from the user's image:
      // 0:ลำดับ, 1:รายการยา, 2:หน่วยนับ, 3:ราคา/หน่วย, 4:ยอดยกมา, 5:มูลค่า..., 6:รับเข้าใหม่, 7:มูลค่า..., 8:จ่ายออก, 9:มูลค่า..., 10:คงเหลือ, 11:มูลค่า..., 12:ขนาดบรรจุ
      if (colMap.name === -1) colMap.name = 1;
      if (colMap.unit === -1) colMap.unit = 2;
      if (colMap.price === -1) colMap.price = 3;
      if (colMap.begin === -1) colMap.begin = 4;
      if (colMap.recv === -1) colMap.recv = 6;
      if (colMap.disp === -1) colMap.disp = 8;
      if (colMap.rem === -1) colMap.rem = 10;
      if (colMap.pack === -1) colMap.pack = 12;

      let importedCount = 0;

      // Scan rows below header
      for (let r = headerRowIndex + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || row.length === 0) continue;

        const name = row[colMap.name];
        if (!name || String(name).trim() === '' || String(name).startsWith('รวม') || String(name).includes('รายงาน')) {
          continue; // skip totals or empty names
        }

        const unit = row[colMap.unit] || '';
        const pack = row[colMap.pack] || '';
        const price = parseFloat(row[colMap.price]) || 0;
        const begin = parseFloat(row[colMap.begin]) || 0;
        const recv = parseFloat(row[colMap.recv]) || 0;
        const disp = parseFloat(row[colMap.disp]) || 0;
        const rem = parseFloat(row[colMap.rem]) || (begin + recv - disp);
        const expiry = row[colMap.expiry] ? String(row[colMap.expiry]).trim() : '';

        // Calculate values
        const recvVal = recv * price;
        const dispVal = disp * price;
        const remVal = rem * price;

        // 1. Insert or update item basic info
        await sqliteQuery.run(`
          INSERT INTO non_drug_items (name, unit, pack_size, unit_price)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            unit = excluded.unit,
            pack_size = excluded.pack_size,
            unit_price = excluded.unit_price
        `, [String(name).trim(), String(unit).trim(), String(pack).trim(), price]);

        // Get the item ID
        const item = await sqliteQuery.get(`SELECT id FROM non_drug_items WHERE name = ?`, [String(name).trim()]);
        const itemId = item.id;

        // 2. Insert or update monthly stock record
        await sqliteQuery.run(`
          INSERT INTO non_drug_monthly_stock 
          (item_id, fiscal_year, month_name, beginning_balance, received_qty, received_value, dispensed_qty, dispensed_value, remaining_qty, remaining_value, expiry_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(item_id, fiscal_year, month_name) DO UPDATE SET
            beginning_balance = excluded.beginning_balance,
            received_qty = excluded.received_qty,
            received_value = excluded.received_value,
            dispensed_qty = excluded.dispensed_qty,
            dispensed_value = excluded.dispensed_value,
            remaining_qty = excluded.remaining_qty,
            remaining_value = excluded.remaining_value,
            expiry_date = excluded.expiry_date
        `, [
          itemId,
          parsedInfo.fiscal_year,
          parsedInfo.month_name,
          begin,
          recv,
          recvVal,
          disp,
          dispVal,
          rem,
          remVal,
          expiry
        ]);

        importedCount++;
      }

      importResults.push({
        sheetName,
        month: parsedInfo.month_name,
        fiscalYear: parsedInfo.fiscal_year,
        importedItems: importedCount
      });
    }

    res.json({
      message: "Import completed successfully.",
      results: importResults
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Export Monthly Inventory Report to Excel
router.get('/export', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: "Missing year or month parameters." });
    }

    const items = await getMonthlyInventoryFromDb(year, month);
    
    // Create Excel Workbook
    const wb = XLSX.utils.book_new();
    
    // Format headers and rows to match user's screenshot
    const excelRows = [
      ['ลำดับ', 'รายการยา', 'หน่วยนับ', 'ราคา/หน่วย', 'ยอดยกมา', 'รับเข้าใหม่', 'มูลค่ารับใหม่', 'จ่ายออก', 'มูลค่าจ่ายออก', 'คงเหลือ', 'มูลค่าคงคลัง', 'วันหมดอายุ']
    ];

    items.forEach((item, idx) => {
      excelRows.push([
        idx + 1,
        item.name,
        item.unit,
        item.unit_price,
        item.beginning_balance,
        item.received_qty,
        item.received_value,
        item.dispensed_qty,
        item.dispensed_value,
        item.remaining_qty,
        item.remaining_value,
        item.expiry_date || ''
      ]);
    });

    // Add Total Row
    if (items.length > 0) {
      const totalRecvVal = items.reduce((sum, item) => sum + (item.received_value || 0), 0);
      const totalDispVal = items.reduce((sum, item) => sum + (item.dispensed_value || 0), 0);
      const totalRemVal = items.reduce((sum, item) => sum + (item.remaining_value || 0), 0);
      excelRows.push([
        'รวม', '', '', '', '', '', totalRecvVal, '', totalDispVal, '', totalRemVal, ''
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, ws, month);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Fix ERR_INVALID_RESPONSE: Use encoded filename for Thai characters
    const encodedFilename = encodeURIComponent(`Inventory_${month}.xlsx`);
    res.setHeader('Content-Disposition', `attachment; filename="Inventory_Export.xlsx"; filename*=UTF-8''${encodedFilename}`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get historical monthly trends for Dashboard Chart
router.get('/trends', async (req, res) => {
  try {
    const sql = `
      SELECT 
        s.month_name,
        s.fiscal_year,
        SUM(s.received_value) as total_received,
        SUM(s.dispensed_value) as total_dispensed,
        SUM(s.remaining_value) as total_inventory
      FROM non_drug_monthly_stock s
      GROUP BY s.fiscal_year, s.month_name
      ORDER BY s.fiscal_year ASC
    `;
    const rows = await sqliteQuery.all(sql);
    
    // Sort chronologically based on Thai Fiscal Year Month order (Oct - Sep)
    const monthsOrder = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."];
    
    rows.sort((a, b) => {
      if (a.fiscal_year !== b.fiscal_year) {
        return a.fiscal_year - b.fiscal_year;
      }
      const aParsed = parseThaiSheetName(a.month_name);
      const bParsed = parseThaiSheetName(b.month_name);
      if (!aParsed || !bParsed) return 0;
      return monthsOrder.indexOf(aParsed.month_abbr) - monthsOrder.indexOf(bParsed.month_abbr);
    });

    // Filter out future months that haven't arrived yet
    const d = new Date();
    const currentYear = d.getFullYear() + 543; // e.g. 2569
    const currentMonthAbbr = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][d.getMonth()];
    
    // Create an absolute index for comparison
    const getAbsoluteIndex = (year, monthAbbr) => {
      const standardMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
      return year * 12 + standardMonths.indexOf(monthAbbr);
    };
    
    const currentIndex = getAbsoluteIndex(currentYear, currentMonthAbbr);

    const filteredRows = rows.filter(row => {
      const parsed = parseThaiSheetName(row.month_name);
      if (!parsed) return true; // keep if parsing fails just in case
      const rowIndex = getAbsoluteIndex(parsed.year, parsed.month_abbr);
      return rowIndex <= currentIndex;
    });

    res.json(filteredRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Save/Update single item stock manual adjustment
router.post('/update-item', async (req, res) => {
  try {
    const { item_id, fiscal_year, month_name, beginning_balance, received_qty, dispensed_qty, unit_price, expiry_date, editor_name } = req.body;
    if (!item_id || !fiscal_year || !month_name) {
      return res.status(400).json({ error: "Missing required parameters." });
    }
    if (!editor_name || String(editor_name).trim() === '') {
      return res.status(400).json({ error: "Editor name is required" });
    }

    const price = parseFloat(unit_price) || 0;
    const begin = parseFloat(beginning_balance) || 0;
    const recv = parseFloat(received_qty) || 0;
    const disp = parseFloat(dispensed_qty) || 0;
    const rem = begin + recv - disp;

    const recvVal = recv * price;
    const dispVal = disp * price;
    const remVal = rem * price;

    // Update item price in basic details
    await sqliteQuery.run(`UPDATE non_drug_items SET unit_price = ? WHERE id = ?`, [price, item_id]);

    // Insert or update monthly details
    await sqliteQuery.run(`
      INSERT INTO non_drug_monthly_stock 
      (item_id, fiscal_year, month_name, beginning_balance, received_qty, received_value, dispensed_qty, dispensed_value, remaining_qty, remaining_value, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id, fiscal_year, month_name) DO UPDATE SET
        beginning_balance = excluded.beginning_balance,
        received_qty = excluded.received_qty,
        received_value = excluded.received_value,
        dispensed_qty = excluded.dispensed_qty,
        dispensed_value = excluded.dispensed_value,
        remaining_qty = excluded.remaining_qty,
        remaining_value = excluded.remaining_value,
        expiry_date = excluded.expiry_date
    `, [
      item_id,
      fiscal_year,
      month_name,
      begin,
      recv,
      recvVal,
      disp,
      dispVal,
      rem,
      remVal,
      expiry_date || ''
    ]);

    // Insert Audit Log for Monthly Stock
    await sqliteQuery.run(`
      INSERT INTO audit_logs (action_type, table_name, record_id, old_values, new_values, changed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['UPDATE_MONTHLY_STOCK', 'non_drug_monthly_stock', item_id, JSON.stringify({ fiscal_year, month_name }), JSON.stringify({ beginning_balance: begin, received_qty: recv, dispensed_qty: disp, remaining_qty: rem, unit_price: price, expiry_date }), editor_name]);

    res.json({ message: "Stock updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MASTER ITEM CATALOG APIs ---

// 6. Get all Master Items list
router.get('/master-items', async (req, res) => {
  try {
    const items = await sqliteQuery.all(`
      SELECT i.*, 
             COALESCE((
               SELECT remaining_qty 
               FROM non_drug_monthly_stock s 
               WHERE s.item_id = i.id 
               ORDER BY 
                 s.fiscal_year DESC,
                 CASE 
                   WHEN s.month_name LIKE 'ต.ค.%' THEN 1
                   WHEN s.month_name LIKE 'พ.ย.%' THEN 2
                   WHEN s.month_name LIKE 'ธ.ค.%' THEN 3
                   WHEN s.month_name LIKE 'ม.ค.%' THEN 4
                   WHEN s.month_name LIKE 'ก.พ.%' THEN 5
                   WHEN s.month_name LIKE 'มี.ค.%' THEN 6
                   WHEN s.month_name LIKE 'เม.ย.%' THEN 7
                   WHEN s.month_name LIKE 'พ.ค.%' THEN 8
                   WHEN s.month_name LIKE 'มิ.ย.%' THEN 9
                   WHEN s.month_name LIKE 'ก.ค.%' THEN 10
                   WHEN s.month_name LIKE 'ส.ค.%' THEN 11
                   WHEN s.month_name LIKE 'ก.ย.%' THEN 12
                   ELSE 0 
                 END DESC,
                 s.id DESC
               LIMIT 1
             ), 0) as current_stock
      FROM non_drug_items i 
      ORDER BY CASE WHEN i.sequence_no IS NULL THEN 1 ELSE 0 END, i.sequence_no ASC, i.name ASC
    `);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Add or update master item
router.post('/master-items', async (req, res) => {
  try {
    const { id, name, unit, pack_size, unit_price, min_stock, report_category, expiry_date, editor_name } = req.body;
    if (!name) return res.status(400).json({ error: "Item name is required" });
    if (!editor_name || String(editor_name).trim() === '') return res.status(400).json({ error: "Editor name is required" });

    if (id) {
      // Get old values
      const oldItem = await sqliteQuery.get('SELECT * FROM non_drug_items WHERE id = ?', [id]);
      
      await sqliteQuery.run(`
        UPDATE non_drug_items 
        SET name=?, unit=?, pack_size=?, unit_price=?, min_stock=?, report_category=?, expiry_date=?
        WHERE id=?
      `, [name, unit || '', pack_size || '', unit_price || 0, min_stock || 10, report_category || 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์', expiry_date || '', id]);

      // Get new values
      const newItem = await sqliteQuery.get('SELECT * FROM non_drug_items WHERE id = ?', [id]);
      
      await sqliteQuery.run(`
        INSERT INTO audit_logs (action_type, table_name, record_id, old_values, new_values, changed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['UPDATE', 'non_drug_items', id, JSON.stringify(oldItem), JSON.stringify(newItem), editor_name]);

    } else {
      const result = await sqliteQuery.run(`
        INSERT INTO non_drug_items (name, unit, pack_size, unit_price, min_stock, report_category, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [name, unit || '', pack_size || '', unit_price || 0, min_stock || 10, report_category || 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์', expiry_date || '']);
      
      const newId = result.lastID;
      const newItem = await sqliteQuery.get('SELECT * FROM non_drug_items WHERE id = ?', [newId]);

      await sqliteQuery.run(`
        INSERT INTO audit_logs (action_type, table_name, record_id, old_values, new_values, changed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['CREATE', 'non_drug_items', newId, null, JSON.stringify(newItem), editor_name]);
    }
    res.json({ message: "Item saved successfully" });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: "Item name already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 8. Import master items from Excel
router.post('/master-items/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No Excel file uploaded." });
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // read first sheet for master list
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (rawData.length < 2) return res.status(400).json({ error: "Excel file is empty or missing data." });

    // Find header row
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(5, rawData.length); r++) {
      if (rawData[r] && rawData[r].some(cell => typeof cell === 'string' && (cell.includes('รายการ') || cell.includes('ชื่อ')))) {
        headerRowIndex = r;
        break;
      }
    }

    const headerRow = rawData[headerRowIndex];
    const colMap = {
      name: headerRow.findIndex(c => typeof c === 'string' && (c.includes('รายการยา') || c.includes('รายการ') || c.includes('ชื่อ'))),
      unit: headerRow.findIndex(c => typeof c === 'string' && (c.includes('หน่วยนับ') || c.includes('หน่วย') || c.includes('ประเภท'))),
      pack: headerRow.findIndex(c => typeof c === 'string' && c.includes('ขนาดบรรจุ')),
      price: headerRow.findIndex(c => typeof c === 'string' && (c.includes('ราคา/หน่วย') || c.includes('ราคาต่อหน่วย') || c.includes('ราคา'))),
      minStock: headerRow.findIndex(c => typeof c === 'string' && (c.includes('ขั้นต่ำ') || c.includes('min')))
    };

    if (colMap.name === -1) colMap.name = 1; // Fallback to column 1 if no header matched
    if (colMap.unit === -1) colMap.unit = 2; // Fallback to column 2
    if (colMap.price === -1) colMap.price = 3; // Fallback to column 3
    if (colMap.pack === -1) colMap.pack = 12; // Fallback to column 12 (from screenshot format)
    
    let imported = 0;
    for (let r = headerRowIndex + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || !row[colMap.name]) continue;
      
      const name = String(row[colMap.name]).trim();
      if (!name || name.startsWith('รวม') || name.includes('รายงาน')) continue;
      
      const unit = row[colMap.unit] ? String(row[colMap.unit]).trim() : '';
      const pack = row[colMap.pack] ? String(row[colMap.pack]).trim() : '';
      const price = parseFloat(row[colMap.price]) || 0;
      const minStock = parseFloat(row[colMap.minStock]) || 10;

      await sqliteQuery.run(`
        INSERT INTO non_drug_items (name, unit, pack_size, unit_price, min_stock)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          unit = excluded.unit,
          pack_size = excluded.pack_size,
          unit_price = excluded.unit_price,
          min_stock = excluded.min_stock
      `, [name, unit, pack, price, minStock]);
      imported++;
    }

    res.json({ message: "Import completed successfully.", importedItems: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete a master item
router.delete('/master-items/:id', async (req, res) => {
  try {
    const editor_name = req.body.editor_name || req.query.editor_name;
    if (!editor_name || String(editor_name).trim() === '') {
      return res.status(400).json({ error: "Editor name is required to delete" });
    }

    const oldItem = await sqliteQuery.get('SELECT * FROM non_drug_items WHERE id = ?', [req.params.id]);
    if (!oldItem) return res.status(404).json({ error: "Item not found" });

    await sqliteQuery.run('UPDATE non_drug_items SET is_active = 0, deleted_by = ? WHERE id = ?', [editor_name, req.params.id]);
    
    await sqliteQuery.run(`
      INSERT INTO audit_logs (action_type, table_name, record_id, old_values, new_values, changed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['DELETE', 'non_drug_items', req.params.id, JSON.stringify(oldItem), JSON.stringify({ is_active: 0, deleted_by: editor_name }), editor_name]);

    res.json({ message: "Item soft-deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore deleted item
router.post('/master-items/:id/restore', async (req, res) => {
  try {
    const editor_name = req.body.editor_name;
    if (!editor_name || String(editor_name).trim() === '') {
      return res.status(400).json({ error: "Editor name is required to restore" });
    }

    const item = await sqliteQuery.get('SELECT * FROM non_drug_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    if (item.deleted_by !== editor_name) {
      return res.status(403).json({ error: "Only the person who deleted this item can restore it." });
    }

    await sqliteQuery.run('UPDATE non_drug_items SET is_active = 1, deleted_by = NULL WHERE id = ?', [req.params.id]);
    
    await sqliteQuery.run(`
      INSERT INTO audit_logs (action_type, table_name, record_id, old_values, new_values, changed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['RESTORE', 'non_drug_items', req.params.id, JSON.stringify(item), JSON.stringify({ is_active: 1, deleted_by: null }), editor_name]);

    res.json({ message: "Item restored successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Get available fiscal years
router.get('/years', async (req, res) => {
  try {
    const rows = await sqliteQuery.all('SELECT DISTINCT fiscal_year FROM non_drug_monthly_stock ORDER BY fiscal_year DESC');
    let years = rows.map(r => r.fiscal_year);

    // Always ensure the CURRENT real-world fiscal year is available so users can start using the system
    const d = new Date();
    const currentYear = d.getFullYear();
    const currentMonth = d.getMonth() + 1;
    let currentFiscalYear = currentYear + 543;
    if (currentMonth >= 10) currentFiscalYear += 1;

    if (!years.includes(currentFiscalYear)) {
      years.push(currentFiscalYear);
    }
    
    // Sort descending
    years.sort((a, b) => b - a);

    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Add a transaction (Receive / Dispense)
router.post('/transactions', async (req, res) => {
  try {
    const { item_id, transaction_date, transaction_type, quantity, unit_price, department, note } = req.body;
    if (!item_id || !transaction_date || !transaction_type || quantity === undefined || unit_price === undefined) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const d = new Date(transaction_date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    let fiscalYear = year + 543;
    if (month >= 10) {
      fiscalYear += 1;
    }
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const monthAbbr = thaiMonths[month - 1];
    const shortYear = (year + 543).toString().slice(-2);
    const monthName = `${monthAbbr}${shortYear}`;

    const total_value = quantity * unit_price;

    // Insert transaction
    await sqliteQuery.run(`
      INSERT INTO non_drug_transactions 
      (item_id, transaction_date, transaction_type, quantity, unit_price, total_value, department, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [item_id, transaction_date, transaction_type, quantity, unit_price, total_value, department || null, note || null]);

    // Update monthly stock
    // Check if row exists
    const existing = await sqliteQuery.get(`
      SELECT * FROM non_drug_monthly_stock 
      WHERE item_id = ? AND fiscal_year = ? AND month_name = ?
    `, [item_id, fiscalYear, monthName]);

    let recv_qty = 0, recv_val = 0, disp_qty = 0, disp_val = 0;
    if (transaction_type === 'RECEIVE') {
      recv_qty = quantity;
      recv_val = total_value;
    } else if (transaction_type === 'DISPENSE') {
      disp_qty = quantity;
      disp_val = total_value;
    }

    if (existing) {
      // Update
      await sqliteQuery.run(`
        UPDATE non_drug_monthly_stock SET
          received_qty = received_qty + ?,
          received_value = received_value + ?,
          dispensed_qty = dispensed_qty + ?,
          dispensed_value = dispensed_value + ?,
          remaining_qty = remaining_qty + ? - ?,
          remaining_value = remaining_value + ? - ?
        WHERE id = ?
      `, [
        recv_qty, recv_val, disp_qty, disp_val,
        recv_qty, disp_qty, recv_val, disp_val,
        existing.id
      ]);
    } else {
      // It doesn't exist. Attempt to find the previous balance.
      const prev = await sqliteQuery.get(`
        SELECT remaining_qty, expiry_date 
        FROM non_drug_monthly_stock
        WHERE item_id = ?
        ORDER BY fiscal_year DESC, id DESC
        LIMIT 1
      `, [item_id]);

      const begin_qty = prev ? prev.remaining_qty : 0;
      // Get the latest price from items table for approximation
      const item = await sqliteQuery.get(`SELECT unit_price FROM non_drug_items WHERE id = ?`, [item_id]);
      const begin_val = begin_qty * (item ? item.unit_price : unit_price); 
      const rem_qty = begin_qty + recv_qty - disp_qty;
      const rem_val = begin_val + recv_val - disp_val;
      const expiry = prev ? prev.expiry_date : null;

      await sqliteQuery.run(`
        INSERT INTO non_drug_monthly_stock 
        (item_id, fiscal_year, month_name, beginning_balance, received_qty, received_value, dispensed_qty, dispensed_value, remaining_qty, remaining_value, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item_id, fiscalYear, monthName,
        begin_qty, recv_qty, recv_val, disp_qty, disp_val, rem_qty, rem_val, expiry
      ]);
    }

    // Also update unit_price in non_drug_items if this is a RECEIVE transaction and price changed
    if (transaction_type === 'RECEIVE') {
       await sqliteQuery.run(`UPDATE non_drug_items SET unit_price = ? WHERE id = ?`, [unit_price, item_id]);
    }

    res.json({ success: true, message: "Transaction recorded successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get recent transactions
router.get('/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const transactions = await sqliteQuery.all(`
      SELECT t.*, i.name as item_name, i.unit
      FROM non_drug_transactions t
      JOIN non_drug_items i ON t.item_id = i.id
      ORDER BY t.transaction_date DESC, t.id DESC
      LIMIT ?
    `, [limit]);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Report 301 API (SINGLE ITEM) ---
router.get('/report301', async (req, res) => {
  const { year, item_id } = req.query;
  if (!year || !item_id) {
    return res.status(400).json({ error: "Missing year or item_id" });
  }

  try {
    // --- STATIC 2568 OVERRIDE ---
    if (year === '2568') {
      try {
        const staticData = require('../report301_2568_static.json');
        const report = staticData.find(r => r.item.id === parseInt(item_id, 10));
        if (report) {
          return res.json(report);
        }
      } catch (e) {
        console.error("Static 2568 data not found or error parsing.", e);
      }
    }
    // -----------------------------

    // Get item details
    const item = await sqliteQuery.get("SELECT id, name, unit, sequence_no FROM non_drug_items WHERE id = ?", [item_id]);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Thai fiscal year months order
    const monthsOrder = [
      'ต.ค.', 'พ.ย.', 'ธ.ค.', 
      'ม.ค.', 'ก.พ.', 'มี.ค.', 
      'เม.ย.', 'พ.ค.', 'มิ.ย.', 
      'ก.ค.', 'ส.ค.', 'ก.ย.'
    ];
    
    // Generate the expected 12 month_names for the given fiscal year
    // e.g. for year 2568: ต.ค.67, พ.ย.67, ธ.ค.67, ม.ค.68, ... ก.ย.68
    const prevYearStr = String(parseInt(year) - 1).substring(2);
    const currYearStr = String(year).substring(2);
    
    const expectedMonthNames = monthsOrder.map((m, idx) => {
      if (idx < 3) return `${m}${prevYearStr}`; // Oct, Nov, Dec of previous year
      return `${m}${currYearStr}`;
    });

    // Fetch monthly records for this item and year
    const records = await sqliteQuery.all(
      `SELECT * FROM non_drug_monthly_stock 
       WHERE item_id = ? AND fiscal_year = ?`,
      [item_id, year]
    );

    // Map records by month_name
    const recordMap = {};
    records.forEach(r => {
      recordMap[r.month_name] = r;
    });

    // Construct the 12-month array
    let currentBalance = 0;
    const reportData = expectedMonthNames.map((month_name, idx) => {
      const rec = recordMap[month_name];
      if (rec) {
        currentBalance = rec.remaining_qty;
        return {
          month_name: month_name,
          beginning_balance: rec.beginning_balance || 0,
          received_date: rec.received_date || '',
          received_qty: rec.received_qty || 0,
          received_value: rec.received_value || 0,
          dispensed_date: rec.dispensed_date || '',
          dispensed_qty: rec.dispensed_qty || 0,
          dispensed_value: rec.dispensed_value || 0,
          remaining_qty: rec.remaining_qty || 0,
          remaining_value: rec.remaining_value || 0,
          note: ''
        };
      } else {
        // No record for this month, carry forward previous balance
        return {
          month_name: month_name,
          beginning_balance: currentBalance,
          received_date: '',
          received_qty: 0,
          received_value: 0,
          dispensed_date: '',
          dispensed_qty: 0,
          dispensed_value: 0,
          remaining_qty: currentBalance,
          remaining_value: 0, // In accurate accounting this should be calc, but 0 is fine for empty rows
          note: ''
        };
      }
    });

    res.json({
      item: item,
      fiscal_year: year,
      data: reportData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Report 301 API (ALL ITEMS) ---
router.get('/report301/all', async (req, res) => {
  const { year } = req.query;
  if (!year) {
    return res.status(400).json({ error: "Missing year" });
  }

  try {
    // --- STATIC 2568 OVERRIDE ---
    if (year === '2568') {
      try {
        const staticData = require('../report301_2568_static.json');
        return res.json(staticData);
      } catch (e) {
        console.error("Static 2568 data not found or error parsing.", e);
      }
    }
    // -----------------------------

    // 1. Get all items ordered by sequence_no
    const items = await sqliteQuery.all("SELECT id, name, unit, sequence_no FROM non_drug_items ORDER BY CASE WHEN sequence_no IS NULL THEN 1 ELSE 0 END, sequence_no ASC, name ASC");
    
    // 2. Thai fiscal year months order
    const monthsOrder = [
      'ต.ค.', 'พ.ย.', 'ธ.ค.', 
      'ม.ค.', 'ก.พ.', 'มี.ค.', 
      'เม.ย.', 'พ.ค.', 'มิ.ย.', 
      'ก.ค.', 'ส.ค.', 'ก.ย.'
    ];
    
    const prevYearStr = String(parseInt(year) - 1).substring(2);
    const currYearStr = String(year).substring(2);
    const expectedMonthNames = monthsOrder.map((m, idx) => {
      if (idx < 3) return `${m}${prevYearStr}`; 
      return `${m}${currYearStr}`;
    });

    // 3. Fetch all monthly records for the year
    const records = await sqliteQuery.all(
      `SELECT * FROM non_drug_monthly_stock WHERE fiscal_year = ?`,
      [year]
    );

    // 4. Map records by item_id and month_name
    const recordMap = {};
    records.forEach(r => {
      if (!recordMap[r.item_id]) recordMap[r.item_id] = {};
      recordMap[r.item_id][r.month_name] = r;
    });

    // 5. Build report for each item
    const allReports = items.map(item => {
      let currentBalance = 0;
      const reportData = expectedMonthNames.map(month_name => {
        const rec = recordMap[item.id] ? recordMap[item.id][month_name] : null;
        if (rec) {
          currentBalance = rec.remaining_qty;
          return {
            month_name: month_name,
            beginning_balance: rec.beginning_balance || 0,
            received_date: rec.received_date || '',
            received_qty: rec.received_qty || 0,
            received_value: rec.received_value || 0,
            dispensed_date: rec.dispensed_date || '',
            dispensed_qty: rec.dispensed_qty || 0,
            dispensed_value: rec.dispensed_value || 0,
            remaining_qty: rec.remaining_qty || 0,
            remaining_value: rec.remaining_value || 0,
            note: ''
          };
        } else {
          return {
            month_name: month_name,
            beginning_balance: currentBalance,
            received_date: '',
            received_qty: 0,
            received_value: 0,
            dispensed_date: '',
            dispensed_qty: 0,
            dispensed_value: 0,
            remaining_qty: currentBalance,
            remaining_value: 0, 
            note: ''
          };
        }
      });

      return {
        item: item,
        fiscal_year: year,
        data: reportData
      };
    });

    res.json(allReports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
