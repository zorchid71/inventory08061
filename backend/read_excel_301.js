const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'รับจ่ายวัสดุ  รพ.สต.บ้านหนองพันท้าว งบ 2568 แก้.xlsx');
try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = "LinK มา รบ.301";
  
  if (!workbook.Sheets[sheetName]) {
    console.log("Sheet not found: " + sheetName);
    console.log("Available sheets:", workbook.SheetNames);
    process.exit(1);
  }
  
  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log("First 30 rows of the sheet:");
  for (let i = 0; i < Math.min(30, jsonData.length); i++) {
    console.log(`Row ${i}:`, jsonData[i]);
  }
} catch (err) {
  console.error("Error reading file:", err.message);
}
