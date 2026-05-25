const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function excelDateToThaiDateString(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
  if (isNaN(date.getTime())) return null;
  
  const d = String(date.getDate());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  let y = date.getFullYear() + 543;
  if (y < 2550) {
    y = (date.getMonth() >= 9) ? 2567 : 2568; 
  }
  return `${d}/${m}/${y}`;
}

function parseFloatSafe(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(parsed) ? null : parsed;
}

const normalizeMonthName = (monthStr) => {
  if (!monthStr || typeof monthStr !== 'string') return monthStr;
  return monthStr.replace('-', '');
};

async function run() {
  const filePath = path.join(__dirname, '..', 'รับจ่ายวัสดุ  รพ.สต.บ้านหนองพันท้าว งบ 2568 แก้.xlsx');
  let workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["LinK มา รบ.301"];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });

  const reports = [];
  let currentReport = null;

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const col0 = String(row[0] || '').trim();
    if (col0.includes('ลำดับที่') && col0.includes('ชื่อเวชภัณฑ์')) {
      if (currentReport) {
        reports.push(currentReport);
      }
      currentReport = {
        item: { sequence_no: null, name: '', unit: '' },
        fiscal_year: '2568',
        data: []
      };

      let seqMatch = col0.match(/ลำดับที่\s+(\d+)/);
      if (seqMatch) {
        currentReport.item.sequence_no = parseInt(seqMatch[1], 10);
      } else {
        for(let v of row) { if (typeof v === 'number') { currentReport.item.sequence_no = v; break; } }
      }

      let name = null;
      let unit = null;
      let foundName = false;
      for (let j = 1; j < row.length; j++) {
        const val = String(row[j] || '').trim();
        if (val === 'หน่วยนับ') {
          unit = String(row[j+1] || '').trim();
          break;
        }
        if (val && !foundName && val !== 'หน่วยนับ' && !val.includes('ลำดับที่')) {
          name = val;
          foundName = true;
        }
      }
      currentReport.item.name = name ? name.replace(/\"/g, '').trim() : 'Unknown';
      currentReport.item.unit = unit || 'N/A';
      continue;
    }

    let monthName = null;
    let rawMonth = row[0];
    
    if (typeof rawMonth === 'number') {
      const d = new Date((rawMonth - 25569) * 86400 * 1000);
      const mIdx = d.getMonth();
      const mStr = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][mIdx];
      const yStr = (mIdx >= 9) ? '67' : '68';
      monthName = `${mStr}${yStr}`;
    } else if (typeof rawMonth === 'string') {
      let m = normalizeMonthName(rawMonth);
      if (m.includes('10') || m.includes('11') || m.includes('67') || m.includes('68')) {
         const isOctNovDec = m.startsWith('ต.ค.') || m.startsWith('พ.ย.') || m.startsWith('ธ.ค.');
         const mStr = m.substring(0, 4); 
         monthName = mStr + (isOctNovDec ? '67' : '68');
      } else if (m.match(/^.*\..*\.\d{2}$/)) {
         monthName = m;
      }
    }

    if (monthName && currentReport) {
      currentReport.data.push({
        month_name: monthName,
        beginning_balance: row[1] !== undefined ? row[1] : '',
        received_date: excelDateToThaiDateString(row[2]) || '',
        received_qty: row[3] !== undefined ? row[3] : '',
        received_value: row[4] !== undefined ? row[4] : '',
        dispensed_date: excelDateToThaiDateString(row[5]) || '',
        dispensed_qty: row[6] !== undefined ? row[6] : '',
        dispensed_value: row[7] !== undefined ? row[7] : '',
        remaining_qty: row[8] !== undefined ? row[8] : '',
        remaining_value: row[9] !== undefined ? row[9] : '',
        note: row[10] || ''
      });
    }
  }

  if (currentReport) {
    reports.push(currentReport);
  }

  // Also attach DB ids so we can match them in /report301?item_id=X
  const { sqliteQuery } = require('./db');
  for (let r of reports) {
    const dbItem = await sqliteQuery.get("SELECT id FROM non_drug_items WHERE sequence_no = ?", [r.item.sequence_no]);
    if (dbItem) {
      r.item.id = dbItem.id;
    }
  }

  const outPath = path.join(__dirname, 'report301_2568_static.json');
  fs.writeFileSync(outPath, JSON.stringify(reports, null, 2));
  console.log(`Extracted ${reports.length} reports to ${outPath}`);
  process.exit(0);
}

setTimeout(run, 1000);
