const xlsx = require('xlsx');
const path = require('path');
const { sqliteQuery, sqliteDb } = require('./db');

async function run() {
  const filePath = path.join(__dirname, '..', 'y2568.xlsx');
  let workbook = xlsx.readFile(filePath);
  
  const sheetNames = workbook.SheetNames;
  console.log(`y2568.xlsx มีทั้งหมด ${sheetNames.length} Sheet ได้แก่: ${sheetNames.join(', ')}`);

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

  let errors = [];
  let previousMonthBalances = {}; // Track balances between sheets of 2568

  // 1. Check Linkage between Sep 67 (from SQLite) and Oct 67 (first sheet of 2568)
  const sep67Records = await sqliteQuery.all(`
    SELECT i.name, s.remaining_qty 
    FROM non_drug_monthly_stock s
    JOIN non_drug_items i ON s.item_id = i.id
    WHERE s.fiscal_year = 2567 AND s.month_name = 'ก.ย.67'
  `);
  const sep67Balances = {};
  sep67Records.forEach(r => { sep67Balances[r.name] = r.remaining_qty; });

  for (let sIdx = 0; sIdx < sheetNames.length; sIdx++) {
    const sheetName = sheetNames[sIdx];
    const stdMonthName = parseThaiSheetName(sheetName) || sheetName;
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    
    let headerRowIdx = -1;
    let header = [];
    for (let r = 0; r < data.length; r++) {
      if (data[r] && data[r].some(cell => String(cell).trim() === 'รายการยา' || String(cell).trim() === 'รายการเวชภัณฑ์')) {
        headerRowIdx = r;
        header = data[r].map(h => String(h || '').trim());
        break;
      }
    }
    
    if (headerRowIdx === -1) {
      errors.push(`[${sheetName}] หาแถว Header (รายการยา) ไม่พบ`);
      continue;
    }
    
    // Find column indices
    let seqCol = header.findIndex(h => h === 'ลำดับ');
    let nameCol = header.findIndex(h => h === 'รายการยา' || h === 'รายการเวชภัณฑ์');
    let begCol = header.findIndex(h => h.includes('ยอดยกมา'));
    let recCol = header.findIndex(h => h === 'รับเข้าใหม่' || h === 'รับมา');
    let dispCol = header.findIndex(h => h === 'จ่ายออก' || h === 'จ่ายไป');
    let remCol = header.findIndex(h => h === 'คงเหลือ' || h === 'ยอดคงเหลือ');

    if (seqCol === -1) seqCol = 0;
    if (nameCol === -1) nameCol = 1;
    if (begCol === -1) begCol = 5; // Column F in 2568
    
    if (recCol === -1) recCol = 6; 
    
    if (dispCol === -1) dispCol = 8;
    
    if (remCol === -1) remCol = 10;

    let currentMonthBalances = {};

    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i];
      const name = row[nameCol];
      if (!name || String(name).trim() === '') continue;

      const cleanName = String(name).trim();
      const beg = parseFloatSafe(row[begCol]);
      const rec = parseFloatSafe(row[recCol]);
      const disp = parseFloatSafe(row[dispCol]);
      const rem = parseFloatSafe(row[remCol]);

      // Check Math
      const expectedRem = beg + rec - disp;
      if (Math.abs(expectedRem - rem) > 0.01) {
        errors.push(`[${sheetName}] Row ${i+1}: "${cleanName}" ยอดไม่ดุล (ยกมา ${beg} + รับ ${rec} - จ่าย ${disp} = ${expectedRem} แต่ในไฟล์คือ ${rem})`);
      }

      // Check cross-month linkage
      if (sIdx === 0) {
        // First sheet (Oct 67), compare with Sep 67 from DB
        const prevBal = sep67Balances[cleanName];
        if (prevBal !== undefined && Math.abs(prevBal - beg) > 0.01) {
          errors.push(`[${sheetName}] Row ${i+1}: "${cleanName}" ยกมา(${beg}) ไม่ตรงกับ คงเหลือ ก.ย.67 ในระบบ(${prevBal})`);
        }
      } else {
        // Compare with previous sheet
        const prevBal = previousMonthBalances[cleanName];
        if (prevBal !== undefined && Math.abs(prevBal - beg) > 0.01) {
          errors.push(`[${sheetName}] Row ${i+1}: "${cleanName}" ยกมา(${beg}) ไม่ตรงกับ คงเหลือเดือนก่อนหน้า(${prevBal})`);
        }
      }

      currentMonthBalances[cleanName] = rem;
    }
    previousMonthBalances = currentMonthBalances;
  }

  const fs = require('fs');
  const outPath = path.join(__dirname, '..', 'analysis_y2568.md');
  let md = `# ผลการวิเคราะห์ข้อมูลไฟล์ y2568.xlsx\n\n`;
  md += `จำนวน Sheet: ${sheetNames.length}\n`;
  md += `รายชื่อ Sheet: ${sheetNames.join(', ')}\n\n`;
  
  if (errors.length === 0) {
    md += `✅ ไม่พบข้อผิดพลาดจากการคำนวณและการเชื่อมโยงยอดยกมาเลย ข้อมูลสมบูรณ์มากครับ!\n`;
  } else {
    md += `⚠️ พบข้อผิดพลาดทั้งหมด ${errors.length} จุด ดังนี้:\n\n`;
    errors.forEach(e => {
      md += `- ${e}\n`;
    });
  }

  fs.writeFileSync(outPath, md);
  console.log('Analysis completed. See analysis_y2568.md');
  process.exit(0);
}

setTimeout(run, 1000);
