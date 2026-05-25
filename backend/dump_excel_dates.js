const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'รับจ่ายวัสดุ  รพ.สต.บ้านหนองพันท้าว งบ 2568 แก้.xlsx');
let workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets["LinK มา รบ.301"];
const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });

console.log("Dumping dates from Excel:");
let foundCount = 0;
for (let i = 0; i < jsonData.length; i++) {
  const row = jsonData[i];
  if (!row || row.length === 0) continue;
  
  const col0 = String(row[0] || '').trim();
  if (col0.includes('ลำดับที่') && col0.includes('ชื่อเวชภัณฑ์')) {
    console.log("ITEM:", col0);
    continue;
  }
  
  if (typeof row[0] === 'number' || (typeof row[0] === 'string' && row[0].includes('.'))) {
    const recDate = row[2];
    const dispDate = row[5];
    if (recDate || dispDate) {
      console.log(`Month: ${row[0]} | Recv: ${recDate} | Disp: ${dispDate}`);
      foundCount++;
    }
  }
}
console.log("Total rows with dates in Excel:", foundCount);
