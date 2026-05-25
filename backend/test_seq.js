const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'รับจ่ายวัสดุ  รพ.สต.บ้านหนองพันท้าว งบ 2568 แก้.xlsx');
let workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets["LinK มา รบ.301"];
const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });

for (let i = 0; i < jsonData.length; i++) {
  const row = jsonData[i];
  if (!row || row.length === 0) continue;

  const col0 = String(row[0] || '').trim();
  if (col0.includes('ลำดับที่') && col0.includes('ชื่อเวชภัณฑ์')) {
    let currentSeqNo = null;
    let seqMatch = col0.match(/ลำดับที่\s+(\d+)/);
    if (seqMatch) {
      currentSeqNo = parseInt(seqMatch[1], 10);
    } else {
      for(let v of row) { if (typeof v === 'number') { currentSeqNo = v; break; } }
    }

    let name = null;
    let foundName = false;
    for (let j = 1; j < row.length; j++) {
      const val = String(row[j] || '').trim();
      if (val === 'หน่วยนับ') { break; }
      if (val && !foundName && val !== 'หน่วยนับ' && !val.includes('ลำดับที่')) {
        name = val;
        foundName = true;
      }
    }
    if (name && name.includes('ฟลูออไรด์')) {
      console.log(`[${currentSeqNo}] ${name}`);
    }
  }
}
