const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'y2567.xlsx');
let workbook = xlsx.readFile(filePath);

const sheetNames = workbook.SheetNames.filter(s => s !== 'ตค 67'); // skip error sheet

for (let sheetName of sheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (!data || data.length === 0) continue;
  const header = data[0].map(h => String(h || '').trim());
  console.log(`\nSheet: ${sheetName}`);
  console.log(JSON.stringify(header));
}
