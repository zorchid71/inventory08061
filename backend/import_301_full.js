const xlsx = require('xlsx');
const path = require('path');
const { sqliteQuery } = require('./db'); 

const normalizeMonthName = (monthStr) => {
  if (!monthStr || typeof monthStr !== 'string') return monthStr;
  return monthStr.replace('-', '');
};

function excelDateToThaiDateString(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
  if (isNaN(date.getTime())) return null;
  
  const d = String(date.getDate());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  let y = date.getFullYear() + 543;
  // If year is 2510 or something weird, assume it's meant to be 2567/2568 based on month
  if (y < 2550) {
    y = (date.getMonth() >= 9) ? 2567 : 2568; 
  }
  return `${d}/${m}/${y}`;
}

function parseFloatSafe(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

async function run() {
  const filePath = path.join(__dirname, '..', 'รับจ่ายวัสดุ  รพ.สต.บ้านหนองพันท้าว งบ 2568 แก้.xlsx');
  console.log('Reading Excel file:', filePath);
  
  let workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["LinK มา รบ.301"];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });

  let currentItemName = null;
  let currentSeqNo = null;
  let currentItemUnit = null;
  let rowsUpdated = 0;

  const targetYear = 2568;

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const col0 = String(row[0] || '').trim();
    if (col0.includes('ลำดับที่') && col0.includes('ชื่อเวชภัณฑ์')) {
      let seqMatch = col0.match(/ลำดับที่\s+(\d+)/);
      if (seqMatch) {
        currentSeqNo = parseInt(seqMatch[1], 10);
      } else {
        for(let v of row) { if (typeof v === 'number') { currentSeqNo = v; break; } }
      }

      let name = null;
      let unit = null;
      let foundName = false;
      for (let j = 1; j < row.length; j++) {
        const val = String(row[j] || '').trim();
        if (val === 'หน่วยนับ') {
          unit = String(row[j+1] || '').trim();
          break;
        }
        if (val && !foundName && val !== 'หน่วยนับ' && !val.includes('ลำดับที่')) {
          name = val;
          foundName = true;
        }
      }
      
      if (name) {
        currentItemName = name.replace(/\"/g, '').trim();
        currentItemUnit = unit || 'N/A';
        const itemRow = await sqliteQuery.get(`SELECT id FROM non_drug_items WHERE REPLACE(name, '"', '') LIKE ? LIMIT 1`, [`%${currentItemName}%`]);
        if (itemRow) {
          await sqliteQuery.run("UPDATE non_drug_items SET sequence_no = ? WHERE id = ?", [currentSeqNo, itemRow.id]);
        }
      }
      continue;
    }

    let monthName = null;
    let rawMonth = row[0];
    
    // We force map the months correctly for FY 2568
    // Oct-Dec -> 67, Jan-Sep -> 68
    if (typeof rawMonth === 'number') {
      const d = new Date((rawMonth - 25569) * 86400 * 1000);
      const mIdx = d.getMonth();
      const mStr = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][mIdx];
      const yStr = (mIdx >= 9) ? '67' : '68';
      monthName = `${mStr}${yStr}`;
    } else if (typeof rawMonth === 'string') {
      let m = normalizeMonthName(rawMonth);
      // Correct year if it's strange
      if (m.includes('10') || m.includes('11') || m.includes('67') || m.includes('68')) {
         const isOctNovDec = m.startsWith('ต.ค.') || m.startsWith('พ.ย.') || m.startsWith('ธ.ค.');
         const mStr = m.substring(0, 4); // "ต.ค."
         monthName = mStr + (isOctNovDec ? '67' : '68');
      }
    }

    if (monthName && monthName.match(/^.*\..*\.\d{2}$/) && currentItemName) {
      const begBal = parseFloatSafe(row[1]);
      const recDate = excelDateToThaiDateString(row[2]);
      const recQty = parseFloatSafe(row[3]);
      const recVal = parseFloatSafe(row[4]);
      const dispDate = excelDateToThaiDateString(row[5]);
      const dispQty = parseFloatSafe(row[6]);
      const dispVal = parseFloatSafe(row[7]);
      const remQty = parseFloatSafe(row[8]);
      const remVal = parseFloatSafe(row[9]);

      const itemRow = await sqliteQuery.get("SELECT id FROM non_drug_items WHERE REPLACE(name, '\"', '') LIKE ? LIMIT 1", [`%${currentItemName}%`]);
      if (itemRow) {
        const existing = await sqliteQuery.get(
          "SELECT id FROM non_drug_monthly_stock WHERE item_id = ? AND fiscal_year = ? AND month_name = ?",
          [itemRow.id, targetYear, monthName]
        );

        if (existing) {
          await sqliteQuery.run(`
            UPDATE non_drug_monthly_stock 
            SET beginning_balance = ?,
                received_date = ?, received_qty = ?, received_value = ?,
                dispensed_date = ?, dispensed_qty = ?, dispensed_value = ?,
                remaining_qty = ?, remaining_value = ?
            WHERE id = ?
          `, [ begBal, recDate, recQty, recVal, dispDate, dispQty, dispVal, remQty, remVal, existing.id ]);
        } else {
          await sqliteQuery.run(`
            INSERT INTO non_drug_monthly_stock 
            (item_id, fiscal_year, month_name, beginning_balance, received_date, received_qty, received_value, dispensed_date, dispensed_qty, dispensed_value, remaining_qty, remaining_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [ itemRow.id, targetYear, monthName, begBal, recDate, recQty, recVal, dispDate, dispQty, dispVal, remQty, remVal ]);
        }
        rowsUpdated++;
      }
    }
  }

  console.log(`\nFull Import Complete! Updated ${rowsUpdated} monthly rows for FY 2568.`);
  process.exit(0);
}

setTimeout(run, 1000);
