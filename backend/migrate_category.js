const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE non_drug_items ADD COLUMN report_category TEXT DEFAULT 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์'", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Migration error:", err.message);
    } else {
      console.log("Migration successful or column already exists.");
    }
    db.close();
  });
});
