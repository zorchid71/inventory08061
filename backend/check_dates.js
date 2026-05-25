const { sqliteQuery } = require('./db');

async function run() {
  const rows = await sqliteQuery.all("SELECT item_id, month_name, received_date, dispensed_date FROM non_drug_monthly_stock WHERE received_date IS NOT NULL OR dispensed_date IS NOT NULL");
  console.log(`Found ${rows.length} rows with dates.`);
  if (rows.length > 0) {
    console.log("First 10:");
    console.log(rows.slice(0, 10));
  }
  process.exit(0);
}

setTimeout(run, 1000);
