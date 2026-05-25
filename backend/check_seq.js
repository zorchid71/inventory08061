const { sqliteQuery } = require('./db');

async function run() {
  const rows = await sqliteQuery.all("SELECT id, name, sequence_no FROM non_drug_items WHERE sequence_no IS NULL OR name LIKE '%ฟลูออไรด์%'");
  console.log("Items with missing sequence_no or Fluoride:");
  console.log(rows);
  process.exit(0);
}

setTimeout(run, 1000);
