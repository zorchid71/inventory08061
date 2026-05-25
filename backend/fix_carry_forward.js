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
  // e.g. "ต.ค.67" or "ต.ค. 67"
  const m = monthStr.match(/^([^\.]+)\.([^\.]+)\.?\s*(\d+)$/);
  if (!m) return { year: 0, month: 0 };
  const name = `${m[1]}.${m[2]}.`;
  const yearShort = parseInt(m[3]);
  const year = yearShort > 50 ? 2500 + yearShort : 2000 + yearShort;
  const monthIdx = monthMap[name] || 0;
  return { year, month: monthIdx };
}

async function run() {
  try {
    const rows = await sqliteQuery.all("SELECT * FROM non_drug_monthly_stock");
    
    // Group by item_id
    const items = {};
    for (const r of rows) {
      if (!items[r.item_id]) items[r.item_id] = [];
      const d = parseMonth(r.month_name);
      items[r.item_id].push({
        ...r,
        sortKey: d.year * 100 + d.month
      });
    }

    let updatedCount = 0;

    for (const itemId in items) {
      const records = items[itemId];
      records.sort((a, b) => a.sortKey - b.sortKey);

      for (let i = 1; i < records.length; i++) {
        const prev = records[i - 1];
        const curr = records[i];

        // If previous month had remaining > 0, and current month has 0 beginning balance
        // Wait, what if they just didn't import the next month yet? 
        // This only applies if the current month record exists.
        if (curr.fiscal_year >= 2568) {
          if (prev.remaining_qty > 0 && curr.beginning_balance === 0) {
            console.log(`Item ${itemId} (${curr.name}) in ${curr.month_name}: setting beginning_balance from 0 to ${prev.remaining_qty}`);
            
            const newBeginning = prev.remaining_qty;
            const newRemaining = newBeginning + curr.received_qty - curr.dispensed_qty;
            const newRemainingValue = newRemaining * curr.unit_price;

            await sqliteQuery.run(`
              UPDATE non_drug_monthly_stock 
              SET beginning_balance = ?, remaining_qty = ?, remaining_value = ?
              WHERE id = ?
            `, [newBeginning, newRemaining, newRemainingValue, curr.id]);

            updatedCount++;
            
            // update in memory so the NEXT month can carry forward if needed
            curr.beginning_balance = newBeginning;
            curr.remaining_qty = newRemaining;
            curr.remaining_value = newRemainingValue;
          }
        }
      }
    }

    console.log(`Updated ${updatedCount} records successfully.`);
  } catch (err) {
    console.error(err);
  } finally {
    sqliteDb.close();
  }
}

run();
