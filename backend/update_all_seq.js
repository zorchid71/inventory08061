const xlsx = require('xlsx');
const path = require('path');
const { sqliteQuery } = require('./db');

async function run() {
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
          name = val.replace(/\"/g, '').trim();
          foundName = true;
        }
      }
      
      if (name && currentSeqNo !== null) {
        console.log(`Updating [${currentSeqNo}] ${name}`);
        await sqliteQuery.run("UPDATE non_drug_items SET sequence_no = ? WHERE REPLACE(name, '\"', '') LIKE ?", [currentSeqNo, `%${name}%`]);
      }
    }
  }
  console.log("Sequence numbers updated.");
  process.exit(0);
}

setTimeout(run, 1000);
