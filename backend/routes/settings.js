const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { recreateMysqlPool } = require('../db');

const multer = require('multer');

const configPath = path.join(__dirname, '..', '..', 'web-hos', 'config.json');
const dbPath = path.join(__dirname, '..', 'inventory.db');

// Setup multer for DB upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..'));
  },
  filename: function (req, file, cb) {
    cb(null, 'inventory_restore.db');
  }
});
const upload = multer({ storage: storage });

// 1. Get current settings
router.get('/', (req, res) => {
  try {
    let config = { host: '', database: '', username: '', password: '', preparer_name: '', reviewer_name: '', approver_name: '', departments: '', report_categories: ['เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์'] };
    let isConnected = false;
    
    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...config, ...savedConfig };
      isConnected = true;
    } else if (fs.existsSync(configPath + '.bak')) {
      // Fallback to .bak if disconnected, so user doesn't have to retype
      const savedConfig = JSON.parse(fs.readFileSync(configPath + '.bak', 'utf8'));
      config = { ...config, ...savedConfig };
      isConnected = false;
    }
    
    res.json({ ...config, isConnected });
  } catch (err) {
    res.status(500).json({ error: "Failed to read configuration: " + err.message });
  }
});

// 2. Test database connection parameters
router.post('/test', async (req, res) => {
  const { host, database, username, password } = req.body;
  if (!host || !database || !username) {
    return res.status(400).json({ error: "Please fill in Host, Database, and Username." });
  }

  let conn = null;
  try {
    conn = await mysql.createConnection({
      host,
      user: username,
      password,
      database,
      connectTimeout: 5000 // 5 seconds timeout
    });
    await conn.ping();
    res.json({ success: true, message: "เชื่อมต่อฐานข้อมูล HOSxP สำเร็จ!" });
  } catch (err) {
    res.status(500).json({ success: false, error: "การเชื่อมต่อล้มเหลว: " + err.message });
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {}
    }
  }
});

// 3. Save database connection parameters and hot-reload connection pool
router.post('/save', async (req, res) => {
  const { host, database, username, password, preparer_name, reviewer_name, approver_name, departments, report_categories } = req.body;
  if (!host || !database || !username) {
    return res.status(400).json({ error: "Please fill in Host, Database, and Username." });
  }

  try {
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    const configData = { 
      ...existingConfig,
      host, database, username, password,
      preparer_name: preparer_name || '',
      reviewer_name: reviewer_name || '',
      approver_name: approver_name || '',
      departments: departments || '',
      report_categories: Array.isArray(report_categories) ? report_categories : ['เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์']
    };
    
    // Save to web-hos/config.json
    const parentDir = path.dirname(configPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 4), 'utf8');

    // Hot-reload/Recreate pool inside db.js
    await recreateMysqlPool(configData);

    res.json({ success: true, message: "บันทึกและเชื่อมต่อระบบฐานข้อมูลใหม่สำเร็จ!" });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: "บันทึกข้อมูลเรียบร้อย แต่ระบบเกิดข้อผิดพลาดในการโหลดการเชื่อมต่อใหม่: " + err.message 
    });
  }
});
// 4. Disconnect from HOSxP Database
router.post('/disconnect', async (req, res) => {
  try {
    if (fs.existsSync(configPath)) {
      const backupPath = configPath + '.bak';
      fs.renameSync(configPath, backupPath);
    }
    
    // Hot-reload to mock mode
    await recreateMysqlPool(null);

    res.json({ success: true, message: "ยกเลิกการเชื่อมต่อกับ HOSxP เรียบร้อยแล้ว (เข้าสู่โหมด Standalone)" });
  } catch (err) {
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการยกเลิกการเชื่อมต่อ: " + err.message });
  }
});

// 5. Clear Test Data
router.post('/clear-data', async (req, res) => {
  const { clearMasterItems } = req.body;
  const { sqliteQuery } = require('../db');
  
  try {
    // Always clear transactions and monthly stock
    await sqliteQuery.run('DELETE FROM non_drug_transactions');
    await sqliteQuery.run('DELETE FROM non_drug_monthly_stock');
    
    let msg = "ล้างข้อมูลประวัติรับ-จ่าย และ ยอดคงเหลือรายเดือนเรียบร้อยแล้ว";
    
    // Optionally clear master items
    if (clearMasterItems) {
      await sqliteQuery.run('DELETE FROM non_drug_items');
      msg = "ล้างข้อมูลทดสอบทั้งหมด (รวมถึงรายการเวชภัณฑ์) เรียบร้อยแล้ว";
    }
    
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการล้างข้อมูล: " + err.message });
  }
});

// 4. Download Database Backup
router.get('/backup', (req, res) => {
  if (fs.existsSync(dbPath)) {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    res.download(dbPath, `inventory_backup_${dateStr}.db`);
  } else {
    res.status(404).json({ error: "Database file not found." });
  }
});

// 5. Restore Database
router.post('/restore', upload.single('db_file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const uploadedFilePath = req.file.path;
    
    // Validate if it looks like a sqlite file (starts with SQLite format 3)
    const header = fs.readFileSync(uploadedFilePath, { encoding: 'utf8', flag: 'r', start: 0, end: 15 });
    if (!header.startsWith('SQLite format 3')) {
      fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ error: "Invalid database file format." });
    }

    // Replace the old DB
    fs.copyFileSync(uploadedFilePath, dbPath);
    fs.unlinkSync(uploadedFilePath);

    // Note: To be perfectly safe, we'd restart the sqliteDb connection.
    // For now, next query will just use the newly overwritten file. 
    // Depending on sqlite3 caching it might need a process restart, but usually it survives a hot-swap if no active locks.

    res.json({ success: true, message: "กู้คืนฐานข้อมูลเรียบร้อยแล้ว แนะนำให้รีเฟรชหน้าเว็บ หรือ Restart Server (ถ้าระบบค้าง)" });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Restore failed: " + err.message });
  }
});

module.exports = router;
