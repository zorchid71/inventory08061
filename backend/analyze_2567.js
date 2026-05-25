const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'y2567.xlsx');
let workbook = xlsx.readFile(filePath);

const sheetNames = workbook.SheetNames;
let previousMonthBalances = {}; // name -> balance
let errors = [];

function parseFloatSafe(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

for (let sIdx = 0; sIdx < sheetNames.length; sIdx++) {
  const sheetName = sheetNames[sIdx];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  
  if (!data || data.length === 0) continue;
  
  const header = data[0].map(h => String(h || '').trim());
  
  // Find column indices
  let nameCol = header.findIndex(h => h === 'รายการยา' || h === 'รายการเวชภัณฑ์');
  let begCol = header.findIndex(h => h.includes('ยอดยกมา'));
  let recCol = header.findIndex(h => h === 'รับเข้าใหม่' || h === 'รับมา');
  let dispCol = header.findIndex(h => h === 'จ่ายออก' || h === 'จ่ายไป');
  let remCol = header.findIndex(h => h === 'คงเหลือ' || h === 'ยอดคงเหลือ');

  if (nameCol === -1) nameCol = 1; // Default
  if (begCol === -1) begCol = 4;
  if (recCol === -1) recCol = 5; // Default for Nov+
  if (sIdx === 0 && header[6] === 'รับเข้าใหม่') recCol = 6;
  if (dispCol === -1) dispCol = 7;
  if (sIdx === 0 && header[8] === 'จ่ายออก') dispCol = 8;
  if (remCol === -1) remCol = 9;
  if (sIdx === 0 && header[10] === 'คงเหลือ') remCol = 10;

  let currentMonthBalances = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name = row[nameCol];
    if (!name) continue;

    const beg = parseFloatSafe(row[begCol]);
    const rec = parseFloatSafe(row[recCol]);
    const disp = parseFloatSafe(row[dispCol]);
    const rem = parseFloatSafe(row[remCol]);

    // Check Math: Beg + Rec - Disp == Rem
    const expectedRem = beg + rec - disp;
    // Allow small float differences
    if (Math.abs(expectedRem - rem) > 0.01) {
      errors.push(`[${sheetName}] Row ${i+1}: "${name}" มีผลคำนวณผิด (ยกมา ${beg} + รับ ${rec} - จ่าย ${disp} = ${expectedRem} แต่ในไฟล์คือ ${rem})`);
    }

    // Check link with previous month
    if (sIdx > 0 && previousMonthBalances[name] !== undefined) {
      if (Math.abs(previousMonthBalances[name] - beg) > 0.01) {
        errors.push(`[${sheetName}] Row ${i+1}: "${name}" ยอดยกมาไม่ตรงกับเดือนก่อน (ยกมา ${beg} แต่เดือนก่อนคงเหลือ ${previousMonthBalances[name]})`);
      }
    }

    currentMonthBalances[name] = rem;
  }

  previousMonthBalances = currentMonthBalances;
}

const outPath = path.join(__dirname, '..', 'analysis_y2567.md');
let md = `# ผลการวิเคราะห์ข้อมูลไฟล์ y2567.xlsx\\n\\n`;
if (errors.length === 0) {
  md += `✅ ไม่พบข้อผิดพลาดจากการคำนวณและการเชื่อมโยงยอดยกมาข้ามเดือนเลย ข้อมูลสมบูรณ์มากครับ!\n`;
} else {
  md += `⚠️ พบข้อผิดพลาดทั้งหมด ${errors.length} จุด ดังนี้:\n\n`;
  errors.forEach(e => {
    md += `- ${e}\n`;
  });
}

fs.writeFileSync(outPath, md);
console.log(`Analysis saved to ${outPath}`);
