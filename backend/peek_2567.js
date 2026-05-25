const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'y2567.xlsx');
let workbook = xlsx.readFile(filePath);

for (let sheetName of ["ต.ค.66", "พ.ย.66"]) {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  for (let i = 0; i < 20 && i < data.length; i++) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]));
  }
}
