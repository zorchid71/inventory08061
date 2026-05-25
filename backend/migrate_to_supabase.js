require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Connect to local SQLite
const sqliteDb = new sqlite3.Database(path.join(__dirname, 'inventory.db'), (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err.message);
    process.exit(1);
  }
  console.log('Connected to local SQLite database (inventory.db).');
});

// Connect to Cloud Postgres
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pgPool.on('connect', () => {
  console.log('Connected to Cloud Postgres database (Supabase).');
});

const tablesToMigrate = [
  'app_settings',
  'non_drug_items',
  'non_drug_monthly_stock',
  'non_drug_transactions',
  'audit_logs',
  'requisitions',
  'requisition_items',
  'purchase_requests',
  'purchase_request_items',
  'non_drug_procurement_plans'
];

function sqliteQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrateData() {
  try {
    // 1. Clear target tables (in reverse dependency order to respect foreign keys)
    console.log('Clearing existing data in Cloud database...');
    for (const table of [...tablesToMigrate].reverse()) {
      await pgPool.query(`DELETE FROM ${table}`);
      console.log(`- Cleared ${table}`);
    }

    // 2. Migrate tables
    for (const table of tablesToMigrate) {
      console.log(`\nMigrating table: ${table}...`);
      const rows = await sqliteQuery(`SELECT * FROM ${table}`);
      
      if (rows.length === 0) {
        console.log(`- No data to migrate for ${table}.`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        try {
          await pgPool.query(sql, values);
        } catch (insertErr) {
          console.error(`- Error inserting row in ${table}:`, insertErr.message, 'Row:', row);
        }
      }
      console.log(`- Migrated ${rows.length} rows to ${table}.`);

      // 3. Update sequences
      // Find primary key column (usually 'id')
      if (columns.includes('id')) {
        const seqSql = `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT MAX(id) FROM ${table}));`;
        try {
          await pgPool.query(seqSql);
          console.log(`- Updated sequence for ${table}.`);
        } catch (seqErr) {
          console.warn(`- Could not update sequence for ${table} (might not be an identity column).`);
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateData();
