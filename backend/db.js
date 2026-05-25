const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');

require('dotenv').config();
const configPath = path.join(__dirname, '..', 'web-hos', 'config.json');
let mysqlConfig = null;

if (fs.existsSync(configPath)) {
  try {
    mysqlConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error("Error reading config.json:", err);
  }
}

// MySQL (HOSxP) pool creation
let mysqlPool = null;
let useMockMysql = false;

if (mysqlConfig) {
  try {
    mysqlPool = mysql.createPool({
      host: mysqlConfig.host,
      user: mysqlConfig.username,
      password: mysqlConfig.password,
      database: mysqlConfig.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      // Automatic conversion from TIS-620 to UTF-8 using typeCast
      typeCast: function (field, next) {
        if (field.type === 'VAR_STRING' || field.type === 'STRING') {
          const buf = field.buffer();
          return buf ? iconv.decode(buf, 'tis620') : null;
        }
        return next();
      }
    });
    console.log("MySQL Pool created for HOSxP.");
  } catch (err) {
    console.error("Failed to create MySQL Pool. Using mock MySQL mode.", err);
    useMockMysql = true;
  }
} else {
  console.log("No config.json found or invalid. Running in Mock MySQL mode.");
  useMockMysql = true;
}

// Test MySQL connection helper
async function checkMysqlConnection() {
  if (useMockMysql || !mysqlPool) return false;
  try {
    const conn = await mysqlPool.getConnection();
    conn.release();
    return true;
  } catch (err) {
    console.warn("MySQL connection test failed, switching to mock mode for health queries:", err.message);
    return false;
  }
}

// PostgreSQL Connection
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
});

pgPool.on('connect', () => {
  console.log('Connected to PostgreSQL (Supabase).');
});
pgPool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Helper wrapper to make pg mimic sqlite3 interface
const sqliteQuery = {
  run: async (sql, params = []) => {
    // Convert ? to $1, $2, etc.
    let pgSql = sql;
    let i = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${i}`);
      i++;
    }
    
    // Automatically add RETURNING id for INSERT statements if not present
    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }

    const res = await pgPool.query(pgSql, params);
    
    // Mimic sqlite3's `this.lastID` and `this.changes`
    return {
      lastID: res.rows.length > 0 && res.rows[0].id ? res.rows[0].id : null,
      changes: res.rowCount
    };
  },
  get: async (sql, params = []) => {
    let pgSql = sql;
    let i = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${i}`);
      i++;
    }
    const res = await pgPool.query(pgSql, params);
    return res.rows[0] || null;
  },
  all: async (sql, params = []) => {
    let pgSql = sql;
    let i = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${i}`);
      i++;
    }
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  }
};

// Generate Mock Data for MySQL queries if connection is not available
const mockPatients = [
  { hn: "000001", pname: "ด.ช.", fname: "สมชาย", lname: "ดีใจ", birthdate: "2024-05-15", village_moo: "1", village_name: "บ้านหนองพัน" },
  { hn: "000002", pname: "ด.ญ.", fname: "สมศรี", lname: "รักดี", birthdate: "2024-08-20", village_moo: "2", village_name: "บ้านคำใต้" },
  { hn: "000003", pname: "ด.ช.", fname: "มานะ", lname: "เก่งกล้า", birthdate: "2023-11-10", village_moo: "1", village_name: "บ้านหนองพัน" },
  { hn: "000004", pname: "ด.ญ.", fname: "ชูใจ", lname: "สวัสดิ์ดี", birthdate: "2022-09-05", village_moo: "3", village_name: "บ้านพัฒนา" },
  { hn: "000005", pname: "ด.ช.", fname: "ปิติ", lname: "สมบูรณ์", birthdate: "2021-04-12", village_moo: "4", village_name: "บ้านดอนเจดีย์" },
  { hn: "000006", pname: "ด.ญ.", fname: "วิภา", lname: "คงทน", birthdate: "2020-07-22", village_moo: "2", village_name: "บ้านคำใต้" },
  { hn: "000007", pname: "ด.ช.", fname: "วีระ", lname: "เพียรทำ", birthdate: "2025-01-30", village_moo: "1", village_name: "บ้านหนองพัน" },
];

const mockPpSpecial = [
  // Child 1 (abnormal -> normal follow-up)
  { hn: "000001", code: "1B261", vstdate: "2025-02-10" },
  { hn: "000001", code: "1B260", vstdate: "2025-03-05" }, // Success in 25 days
  // Child 2 (abnormal but lost track)
  { hn: "000002", code: "1B261", vstdate: "2025-01-15" }, // Lost track (> 30 days)
  // Child 3 (normal)
  { hn: "000003", code: "1B260", vstdate: "2024-12-05" },
  // Child 4 (abnormal -> delayed)
  { hn: "000004", code: "1B261", vstdate: "2025-03-01" },
  { hn: "000004", code: "1B261", vstdate: "2025-03-25" }, // Delay (still abnormal)
  // Child 5 (abnormal -> refer)
  { hn: "000005", code: "1B261", vstdate: "2025-02-20" },
  { hn: "000005", code: "1B262", vstdate: "2025-03-10" }, // Refer
  // Child 6 (overdue) - no records at all, birthdate is 2020-07-22 (60M target in FY 2568, target date 2025-07-22)
];

const mockTtmServices = [
  { vn: "6801010001", hn: "000100", vstdate: "2025-05-10", spclty: "48", pname: "นาย", fname: "ทองดี", lname: "โบราณ", icd10_list: "U5000, U5100" },
  { vn: "6801010002", hn: "000101", vstdate: "2025-05-12", spclty: "01", pname: "นาง", fname: "สายใจ", lname: "รักษ์ไทย", icd10_list: "U6201, K290" },
  { vn: "6801010003", hn: "000102", vstdate: "2025-05-15", spclty: "48", pname: "น.ส.", fname: "จันทร์เพ็ญ", lname: "นวดดี", icd10_list: "U5010" },
  { vn: "6801010004", hn: "000103", vstdate: "2025-05-16", spclty: "01", pname: "นาย", fname: "ดำเกิง", lname: "ชื่นชม", icd10_list: "J00" }, // Not TTM
];

const mockTtmDrugs = [
  { vstdate: "2025-05-10", hn: "000100", pname: "นาย", fname: "ทองดี", lname: "โบราณ", drug_name: "ยาแก้ไอมะขามป้อม", did: "401010101010101010101011", qty: 2, sum_price: 30, pttype: "30 บาท", drugaccount: "1" },
  { vstdate: "2025-05-12", hn: "000101", pname: "นาง", fname: "สายใจ", lname: "รักษ์ไทย", drug_name: "ขมิ้นชันแคปซูล 250มก.", did: "401010101010101010101012", qty: 3, sum_price: 45, pttype: "30 บาท", drugaccount: "1" },
  { vstdate: "2025-05-15", hn: "000102", pname: "น.ส.", fname: "จันทร์เพ็ญ", lname: "นวดดี", drug_name: "ยาแคปซูลเถาวัลย์เปรียง", did: "40101", qty: 10, sum_price: 150, pttype: "ข้าราชการ", drugaccount: "2" }, // Invalid DID (not 24 chars)
];

// Helper to check if MySQL is available and query, or fallback to mock
async function queryMysql(sql, params = []) {
  const isConnected = await checkMysqlConnection();
  if (isConnected && mysqlPool) {
    try {
      const [rows] = await mysqlPool.execute(sql, params);
      return rows;
    } catch (err) {
      console.error("MySQL Query execution error, fallback to mock data:", err);
    }
  }
  
  // Return fallback Mock Data based on SQL pattern keywords
  console.log("Using local mock data for MySQL query:", sql.substring(0, 100) + "...");
  if (sql.includes("person") && sql.includes("village")) {
    // Child Development Target query
    return simulateChildDevelopmentTargetQuery(sql, params);
  }
  
  if (sql.includes("pp_special") && sql.includes("pp_special_type")) {
    // Child Development History query
    return simulateChildDevelopmentHistoryQuery(sql, params);
  }
  
  if (sql.includes("vn_stat") && sql.includes("icd10 LIKE 'U%'") && !sql.includes("did LIKE")) {
    if (sql.includes("COUNT(")) {
      // KPI stats
      return [{ total_opd: 150, total_ttm: 25 }];
    } else {
      // Patients list
      return mockTtmServices.filter(s => s.spclty === "48" || s.icd10_list.includes("U"));
    }
  }

  if (sql.includes("opitemrece") && sql.includes("did LIKE '4%'")) {
    // Herbal Drug list
    return mockTtmDrugs;
  }
  
  if (sql.includes("SELECT DISTINCT IF(MONTH(vstdate)") || sql.includes("SELECT DISTINCT village_moo")) {
    // Years / Village lists
    if (sql.includes("village")) {
      return [
        { village_moo: "1", village_name: "บ้านหนองพัน" },
        { village_moo: "2", village_name: "บ้านคำใต้" },
        { village_moo: "3", village_name: "บ้านพัฒนา" },
        { village_moo: "4", village_name: "บ้านดอนเจดีย์" }
      ];
    } else {
      return [2026, 2025, 2024];
    }
  }

  return [];
}

// Sub-simulators for complex MySQL queries
function simulateChildDevelopmentTargetQuery(sql, params) {
  // Extract fiscal year from query or default
  // Usually the query has variables from js. We just return mock patients processed as targets.
  return mockPatients.map(p => {
    // Determine target group based on birthdate
    const birthDate = new Date(p.birthdate);
    const targetGroupMonths = [9, 18, 30, 42, 60];
    let targetGroup = "9 ด.";
    let targetDateStr = p.birthdate;
    
    // Choose one target group that makes sense for simulated fiscal year (say 2025 / BE 2568)
    // For simplicity, assign based on HN
    const hnNum = parseInt(p.hn) % 5;
    const months = targetGroupMonths[hnNum];
    targetGroup = `${months} ด.`;
    const targetDate = new Date(birthDate);
    targetDate.setMonth(targetDate.getMonth() + months);
    targetDateStr = targetDate.toISOString().split('T')[0];

    // Find services
    const childServices = mockPpSpecial.filter(s => s.hn === p.hn).sort((a,b) => new Date(a.vstdate) - new Date(b.vstdate));
    const firstService = childServices[0];
    const lastService = childServices[childServices.length - 1];

    return {
      hn: p.hn,
      pname: p.pname,
      fname: p.fname,
      lname: p.lname,
      birthdate: p.birthdate,
      moo: p.village_moo,
      village_name: p.village_name,
      target_group: targetGroup,
      target_date: targetDateStr,
      first_date: firstService ? firstService.vstdate : null,
      first_code: firstService ? firstService.code : null,
      last_date: lastService ? lastService.vstdate : null,
      last_code: lastService ? lastService.code : null
    };
  });
}

function simulateChildDevelopmentHistoryQuery(sql, params) {
  // Join mockPpSpecial with mockPatients
  return mockPpSpecial.map(s => {
    const p = mockPatients.find(pat => pat.hn === s.hn) || { pname: "", fname: "Unknown", lname: "", village_moo: "1", village_name: "Mock Village" };
    // Calculate approximate age in months at vstdate
    const bDate = new Date(p.birthdate);
    const vDate = new Date(s.vstdate);
    const diffMonths = (vDate.getFullYear() - bDate.getFullYear()) * 12 + (vDate.getMonth() - bDate.getMonth());
    
    return {
      hn: s.hn,
      pp_special_code: s.code,
      vstdate: s.vstdate,
      vn: "VN" + s.hn + s.vstdate.replace(/-/g, ""),
      age_month: diffMonths,
      pname: p.pname,
      fname: p.fname,
      lname: p.lname,
      moo: p.village_moo,
      village_name: p.village_name
    };
  });
}

// Function to dynamically recreate the MySQL Pool
async function recreateMysqlPool(newConfig) {
  if (mysqlPool) {
    try {
      await mysqlPool.end();
      console.log("Old MySQL connection pool closed.");
    } catch (err) {
      console.error("Error closing old MySQL pool:", err);
    }
    mysqlPool = null;
  }

  if (!newConfig) {
    useMockMysql = true;
    console.log("Disconnected MySQL, using Mock Mode.");
    return true;
  }

  try {
    mysqlPool = mysql.createPool({
      host: newConfig.host,
      user: newConfig.username,
      password: newConfig.password,
      database: newConfig.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      typeCast: function (field, next) {
        if (field.type === 'VAR_STRING' || field.type === 'STRING') {
          const buf = field.buffer();
          return buf ? iconv.decode(buf, 'tis620') : null;
        }
        return next();
      }
    });
    // Test the pool
    const conn = await mysqlPool.getConnection();
    conn.release();
    useMockMysql = false;
    console.log("New MySQL Pool successfully created and tested.");
    return true;
  } catch (err) {
    console.error("Failed to connect with new MySQL config:", err.message);
    useMockMysql = true;
    mysqlPool = null;
    throw err;
  }
}

async function pgQuery(text, params) {
  let counter = 1;
  const pgText = text.replace(/\?/g, () => `$${counter++}`);
  const finalQuery = text.trim().toUpperCase().startsWith('INSERT') ? `${pgText} RETURNING id` : pgText;
  return await pgPool.query(finalQuery, params);
}

module.exports = { checkMysqlConnection, queryMysql, sqliteQuery, pgPool, pgQuery, recreateMysqlPool };
