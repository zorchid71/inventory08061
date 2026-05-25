const xlsx = require('xlsx');
const path = require('path');
const { sqliteQuery } = require('./db'); // Wait, db.js initializes SQLite synchronously, we can use it.

// Map Thai abbreviated months to month_name used in DB (e.g. "ต.ค.-67" -> "ต.ค.67")
const normalizeMonthName = (monthStr) => {
  if (!monthStr || typeof monthStr !== 'string') return monthStr;
  // Remove hyphens. "ต.ค.-67" -> "ต.ค.67"
  return monthStr.replace('-', '');
};

// Convert Excel Date Number to string DD/MM/YYYY (Thai Year)
function excelDateToThaiDateString(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate; // Already string
  // Excel epoch starts on Jan 1 1900
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // 25567 is days from 1900 to 1970, +2 for excel bug
  if (isNaN(date.getTime())) return null;
  
  const d = String(date.getDate());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear() + 543);
  return `${d}/${m}/${y}`;
}

async function run() {
  const filePath = path.join(__dirname, '..', 'รับจ่ายวัสดุ  รพ.สต.บ้านหนองพันท้าว งบ 2568 แก้.xlsx');
  console.log('Reading Excel file:', filePath);
  
  let workbook;
  try {
    workbook = xlsx.readFile(filePath);
  } catch (err) {
    console.error("Failed to read file. Please ensure it exists and is not open in another program.");
    process.exit(1);
  }

  const sheetName = "LinK มา รบ.301";
  if (!workbook.Sheets[sheetName]) {
    console.log("Sheet not found:", sheetName);
    process.exit(1);
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });

  console.log(`Loaded ${jsonData.length} rows.`);

  let currentItemName = null;
  let itemsUpdated = 0;

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    // Detect new item block.
    // Example: [ '                      ลำดับที่     1         ชื่อเวชภัณฑ์หรือสิ่งของ           ', <3 empty items>, 'Autoclave tape 3/4"', <4 empty items>, '  หน่วยนับ   ', 'ม้วน' ]
    const col0 = String(row[0] || '').trim();
    if (col0.includes('ลำดับที่') && col0.includes('ชื่อเวชภัณฑ์')) {
      // Find the item name
      // Usually it's in a subsequent column. Let's look for a string that is not "หน่วยนับ"
      let name = null;
      for (let j = 1; j < row.length; j++) {
        const val = String(row[j] || '').trim();
        if (val && val !== 'หน่วยนับ' && !val.includes('ม้วน') && !val.includes('กล่อง') && !val.includes('แกลลอน') && !val.includes('ซอง') && !val.includes('ขวด') && !val.includes('ชุด')) {
          name = val;
          break;
        }
      }
      if (name) {
        currentItemName = name.replace(/\"/g, '').trim(); // Remove quotes for cleaner matching
        console.log("Found Item Block:", currentItemName);
      }
      continue;
    }

    // Detect month row
    // Column 0 is the month (e.g. 24746 which is maybe a weird date, OR string like "ต.ค.-67")
    // Wait, in our test `node read_excel_301.js`, the month column was parsed as a number `24746`.
    // Actually, "ต.ค.-67" in Excel might be interpreted as Oct 1967 (1967-10-01) -> 24746 days.
    // Let's decode it: 
    let monthName = null;
    let rawMonth = row[0];
    
    if (typeof rawMonth === 'number') {
      const d = new Date((rawMonth - 25569) * 86400 * 1000);
      const mStr = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][d.getMonth()];
      let yStr = String((d.getFullYear() + 543) % 100);
      monthName = `${mStr}${yStr}`;
    } else if (typeof rawMonth === 'string') {
      monthName = normalizeMonthName(rawMonth);
    }

    // Only process if it looks like a month string (e.g., "ต.ค.67")
    if (monthName && monthName.match(/^[ก-ฮ]\.[ก-ฮ]\.\d{2}$/) && currentItemName) {
      // Received date is at index 2, Dispensed date is at index 5
      const receivedRaw = row[2];
      const dispensedRaw = row[5];
      
      const receivedDate = excelDateToThaiDateString(receivedRaw);
      const dispensedDate = excelDateToThaiDateString(dispensedRaw);

      if (receivedDate || dispensedDate) {
        // Look up item_id
        // We use LIKE because the Excel name might differ slightly from DB
        const itemQuery = `SELECT id FROM non_drug_items WHERE REPLACE(name, '"', '') LIKE ? LIMIT 1`;
        const itemRow = await sqliteQuery.get(itemQuery, [`%${currentItemName}%`]);
        
        if (itemRow) {
          const itemId = itemRow.id;
          
          // Determine fiscal year from monthName
          let yy = parseInt(monthName.substring(monthName.length - 2));
          let fullYear = 2500 + yy;
          // If Oct, Nov, Dec -> it's part of the NEXT fiscal year
          if (monthName.startsWith('ต.ค.') || monthName.startsWith('พ.ย.') || monthName.startsWith('ธ.ค.')) {
            fullYear += 1;
          }
          
          const updateQuery = `
            UPDATE non_drug_monthly_stock 
            SET received_date = ?, dispensed_date = ?
            WHERE item_id = ? AND fiscal_year = ? AND month_name = ?
          `;
          
          await sqliteQuery.run(updateQuery, [
            receivedDate || null,
            dispensedDate || null,
            itemId,
            fullYear,
            monthName
          ]);
          
          itemsUpdated++;
          console.log(`Updated [${currentItemName}] ${monthName} -> Recv: ${receivedDate}, Disp: ${dispensedDate}`);
        } else {
          console.log(`Warning: Item not found in DB [${currentItemName}]`);
        }
      }
    }
  }

  console.log(`\nImport complete! Updated ${itemsUpdated} monthly records.`);
  process.exit(0);
}

// Ensure db tables are initialized before running
setTimeout(run, 1000);
