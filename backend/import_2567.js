const xlsx = require('xlsx');
const path = require('path');
const { sqliteQuery } = require('./db');

async function run() {
  const filePath = path.join(__dirname, '..', 'y2567.xlsx');
  let workbook = xlsx.readFile(filePath);
  
  const sheetNames = workbook.SheetNames.filter(s => s !== 'ตค 67'); // skip error sheet
  
  function parseFloatSafe(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const parsed = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  function parseThaiSheetName(sheetName) {
    const cleanName = sheetName.trim();
    const match = cleanName.match(/(.+?)[\s_]*(\d{2,4})$/);
    if (!match) return null;

    let rawMonth = match[1].replace(/[\s\.]/g, '');
    let yearShort = parseInt(match[2]);

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

    return `${monthAbbr}${yearShort < 100 ? yearShort : yearShort - 2500}`;
  }

  let totalImported = 0;

  for (let sIdx = 0; sIdx < sheetNames.length; sIdx++) {
    const sheetName = sheetNames[sIdx];
    const stdMonthName = parseThaiSheetName(sheetName) || sheetName;
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    
    if (!data || data.length === 0) continue;
    
    const header = data[0].map(h => String(h || '').trim());
    
    // Find column indices
    let seqCol = header.findIndex(h => h === 'ลำดับ');
    let nameCol = header.findIndex(h => h === 'รายการยา' || h === 'รายการเวชภัณฑ์');
    let unitCol = header.findIndex(h => h === 'หน่วยนับ');
    let priceCol = header.findIndex(h => h === 'ราคา/หน่วย');
    let begCol = header.findIndex(h => h.includes('ยอดยกมา'));
    let recCol = header.findIndex(h => h === 'รับเข้าใหม่' || h === 'รับมา');
    let dispCol = header.findIndex(h => h === 'จ่ายออก' || h === 'จ่ายไป');
    let remCol = header.findIndex(h => h === 'คงเหลือ' || h === 'ยอดคงเหลือ');
    let packCol = header.findIndex(h => h === 'ขนาดบรรจุ');

    // defaults based on peek
    if (seqCol === -1) seqCol = 0;
    if (nameCol === -1) nameCol = 1;
    if (unitCol === -1) unitCol = 2;
    if (priceCol === -1) priceCol = 3;
    if (begCol === -1) begCol = 4;
    
    if (recCol === -1) recCol = 5; 
    if (sIdx === 0 && header[6] === 'รับเข้าใหม่') recCol = 6;
    
    if (dispCol === -1) dispCol = 7;
    if (sIdx === 0 && header[8] === 'จ่ายออก') dispCol = 8;
    
    if (remCol === -1) remCol = 9;
    if (sIdx === 0 && header[10] === 'คงเหลือ') remCol = 10;
    
    if (packCol === -1) packCol = 13;
    if (sIdx === 0 && header[12] === 'ขนาดบรรจุ') packCol = 12;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = row[nameCol];
      if (!name || String(name).trim() === '') continue;

      const cleanName = String(name).trim();
      const unit = row[unitCol] ? String(row[unitCol]).trim() : '';
      const pack = row[packCol] ? String(row[packCol]).trim() : '';
      const price = parseFloatSafe(row[priceCol]);
      let seq = parseInt(row[seqCol], 10);
      if (isNaN(seq)) seq = null;

      const beg = parseFloatSafe(row[begCol]);
      const rec = parseFloatSafe(row[recCol]);
      const disp = parseFloatSafe(row[dispCol]);
      const rem = parseFloatSafe(row[remCol]);

      // Insert or Update Item
      await sqliteQuery.run(`
        INSERT INTO non_drug_items (name, unit, pack_size, unit_price, sequence_no)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          unit = excluded.unit,
          pack_size = excluded.pack_size,
          unit_price = excluded.unit_price,
          sequence_no = COALESCE(non_drug_items.sequence_no, excluded.sequence_no)
      `, [cleanName, unit, pack, price, seq]);

      const itemRow = await sqliteQuery.get(`SELECT id FROM non_drug_items WHERE name = ?`, [cleanName]);
      if (!itemRow) continue;

      // Insert into Monthly Stock
      await sqliteQuery.run(`
        INSERT INTO non_drug_monthly_stock 
        (item_id, fiscal_year, month_name, beginning_balance, received_qty, received_value, dispensed_qty, dispensed_value, remaining_qty, remaining_value)
        VALUES (?, 2567, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(item_id, fiscal_year, month_name) DO UPDATE SET
          beginning_balance = excluded.beginning_balance,
          received_qty = excluded.received_qty,
          received_value = excluded.received_value,
          dispensed_qty = excluded.dispensed_qty,
          dispensed_value = excluded.dispensed_value,
          remaining_qty = excluded.remaining_qty,
          remaining_value = excluded.remaining_value
      `, [
        itemRow.id,
        stdMonthName,
        beg,
        rec,
        rec * price,
        disp,
        disp * price,
        rem,
        rem * price
      ]);

      totalImported++;
    }
    console.log(`Processed sheet ${sheetName}`);
  }

  console.log(`Done! Total monthly records imported/updated: ${totalImported}`);
  process.exit(0);
}

setTimeout(run, 1000);
