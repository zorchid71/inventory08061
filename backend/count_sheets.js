const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'y2567.xlsx');
try {
  const workbook = xlsx.readFile(filePath);
  console.log("Sheet names:");
  workbook.SheetNames.forEach((name, i) => {
    console.log(`[${i + 1}] ${name}`);
  });
  console.log(`Total sheets: ${workbook.SheetNames.length}`);
} catch (e) {
  console.error("Error reading file:", e.message);
}
