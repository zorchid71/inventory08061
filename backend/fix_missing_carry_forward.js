const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'inventory.db');
const sqliteDb = new sqlite3.Database(dbFile);

const sqliteQuery = {
  run: (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  }),
  get: (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  }),
  all: (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  })
};

const monthMap = {
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12
};

function parseMonth(monthStr) {
  const m = monthStr.match(/^([^\.]+)\.([^\.]+)\.?\s*(\d+)$/);
  if (!m) return { year: 0, month: 0, name: monthStr };
  const name = `${m[1]}.${m[2]}.`;
  const yearShort = parseInt(m[3]);
  const y = yearShort > 50 ? 2500 + yearShort : 2000 + yearShort;
  const mo = monthMap[name] || 0;
  return { year: y, month: mo, name: monthStr, sortKey: y * 100 + mo };
}

async function run() {
  try {
    const rawRows = await sqliteQuery.all("SELECT * FROM non_drug_monthly_stock");
    
    // Determine the ordered list of months that exist in the database
    const monthSet = new Set();
    rawRows.forEach(r => monthSet.add(r.month_name));
    
    const sortedMonths = Array.from(monthSet)
      .map(parseMonth)
      .sort((a, b) => a.sortKey - b.sortKey);
      
    console.log(`Found ${sortedMonths.length} unique months.`);

    // We will organize data by item_id
    // itemsData[item_id] = { monthName: rowData }
    const itemsData = {};
    for (const r of rawRows) {
      if (!itemsData[r.item_id]) itemsData[r.item_id] = {};
      itemsData[r.item_id][r.month_name] = r;
    }

    let insertedCount = 0;

    // We only want to start checking from the month BEFORE the start of FY 2568.
    // FY 2568 starts at "ต.ค.67". The month before it is "ก.ย.67".
    // So we iterate from the second month in sortedMonths.
    
    for (let i = 1; i < sortedMonths.length; i++) {
      const prevMonth = sortedMonths[i - 1];
      const currMonth = sortedMonths[i];
      
      // Wait, "เริ่มตั้งแต่ปีงบประมาณ 2568 ถึงปีปัจจุบัน"
      // FY 2568 begins in ต.ค.67 (sortKey: 256710)
      if (currMonth.sortKey < 256710) continue; 
      
      const currFiscalYear = currMonth.month >= 10 ? currMonth.year + 1 : currMonth.year;

      for (const itemId in itemsData) {
        const itemHistory = itemsData[itemId];
        const prevRecord = itemHistory[prevMonth.name];
        
        if (prevRecord && prevRecord.remaining_qty > 0) {
          const currRecord = itemHistory[currMonth.name];
          
          if (!currRecord) {
            // It's missing! Insert it.
            const newBeginning = prevRecord.remaining_qty;
            const newRemaining = newBeginning; // received=0, dispensed=0
            const newRemainingValue = newRemaining * (prevRecord.unit_price || 0);
            
            console.log(`Inserting missing record for item ${itemId} in ${currMonth.name} (carried from ${prevMonth.name}, qty: ${newBeginning})`);

            await sqliteQuery.run(`
              INSERT INTO non_drug_monthly_stock 
              (item_id, fiscal_year, month_name, beginning_balance, received_qty, dispensed_qty, remaining_qty, remaining_value, expiry_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              itemId,
              currFiscalYear,
              currMonth.name,
              newBeginning,
              0, // received
              0, // dispensed
              newRemaining,
              newRemainingValue,
              prevRecord.expiry_date
            ]);

            insertedCount++;
            
            // Add to itemsData so the next month can carry it forward!
            itemsData[itemId][currMonth.name] = {
              item_id: itemId,
              fiscal_year: currFiscalYear,
              month_name: currMonth.name,
              beginning_balance: newBeginning,
              received_qty: 0,
              dispensed_qty: 0,
              remaining_qty: newRemaining,
              remaining_value: newRemainingValue,
              unit_price: prevRecord.unit_price,
              expiry_date: prevRecord.expiry_date
            };
          }
        }
      }
    }

    console.log(`Inserted ${insertedCount} missing carry-forward records successfully.`);
  } catch (err) {
    console.error(err);
  } finally {
    sqliteDb.close();
  }
}

run();
