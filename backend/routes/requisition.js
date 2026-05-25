const express = require('express');
const router = express.Router();
const { sqliteQuery } = require('../db');

// --- SETTINGS APIs ---

// Get all settings
router.get('/settings', async (req, res) => {
  try {
    const rows = await sqliteQuery.all('SELECT * FROM app_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings
router.post('/settings', async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await sqliteQuery.run(`
        INSERT INTO app_settings (setting_key, setting_value) 
        VALUES (?, ?) 
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
      `, [key, value]);
    }
    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REQUISITION APIs ---

// 1. Generate Next Requisition Number (e.g. 001/2569)
router.get('/next-number', async (req, res) => {
  try {
    const d = new Date();
    let thaiYear = d.getFullYear() + 543;
    if (d.getMonth() >= 9) thaiYear += 1; // Fiscal year logic if needed, but let's use calendar year or fiscal year. Let's use Thai Fiscal Year.

    // Get the latest req_number for this year
    const latest = await sqliteQuery.get(`
      SELECT req_number FROM requisitions 
      WHERE req_number LIKE '%/' || ? 
      ORDER BY id DESC LIMIT 1
    `, [thaiYear]);

    let nextNum = 1;
    if (latest && latest.req_number) {
      const parts = latest.req_number.split('/');
      if (parts.length === 2) {
        nextNum = parseInt(parts[0], 10) + 1;
      }
    }

    const formattedNum = String(nextNum).padStart(3, '0') + '/' + thaiYear;
    res.json({ req_number: formattedNum });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get unbilled dispense transactions
router.get('/unbilled', async (req, res) => {
  try {
    const unbilled = await sqliteQuery.all(`
      SELECT t.*, i.name as item_name, i.unit 
      FROM non_drug_transactions t
      JOIN non_drug_items i ON t.item_id = i.id
      WHERE t.transaction_type = 'DISPENSE' AND t.req_id IS NULL
      ORDER BY t.transaction_date ASC
    `);
    res.json(unbilled);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create Requisition
router.post('/', async (req, res) => {
  try {
    const { req_number, req_date, purpose, requisitioner_name, dispenser_name, director_name, items, transaction_ids } = req.body;
    
    if (!req_number || !req_date || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields or items." });
    }

    // Insert Requisition
    const result = await sqliteQuery.run(`
      INSERT INTO requisitions (req_number, req_date, purpose, requisitioner_name, dispenser_name, director_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req_number, req_date, purpose || 'เพื่อใช้ในการบริการส่งเสริม ป้องกัน รักษา และฟื้นฟู', requisitioner_name, dispenser_name, director_name]);

    const reqId = result.lastID;

    // Insert Items
    for (const item of items) {
      const qty = parseFloat(item.requested_qty);
      await sqliteQuery.run(`
        INSERT INTO requisition_items (req_id, item_id, requested_qty, dispensed_qty, note)
        VALUES (?, ?, ?, ?, ?)
      `, [reqId, item.item_id, qty, qty, item.note || '']);
    }

    // Link the transactions if provided
    if (transaction_ids && transaction_ids.length > 0) {
      const placeholders = transaction_ids.map(() => '?').join(',');
      await sqliteQuery.run(`
        UPDATE non_drug_transactions 
        SET req_id = ? 
        WHERE id IN (${placeholders})
      `, [reqId, ...transaction_ids]);
    }

    res.json({ success: true, req_id: reqId, message: "Requisition created successfully." });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: "Requisition number already exists." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 3. Get All Requisitions
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const requisitions = await sqliteQuery.all(`
      SELECT * FROM requisitions 
      ORDER BY id DESC LIMIT ?
    `, [limit]);

    // Fetch items for each (inefficient N+1 but fine for local sqlite)
    for (let i = 0; i < requisitions.length; i++) {
      const items = await sqliteQuery.all(`
        SELECT ri.*, i.name as item_name, i.unit 
        FROM requisition_items ri
        JOIN non_drug_items i ON ri.item_id = i.id
        WHERE ri.req_id = ?
      `, [requisitions[i].id]);
      requisitions[i].items = items;
    }

    res.json(requisitions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Single Requisition Details
router.get('/:id', async (req, res) => {
  try {
    const reqData = await sqliteQuery.get(`SELECT * FROM requisitions WHERE id = ?`, [req.params.id]);
    if (!reqData) return res.status(404).json({ error: "Requisition not found" });

    const items = await sqliteQuery.all(`
      SELECT ri.*, i.name as item_name, i.unit 
      FROM requisition_items ri
      JOIN non_drug_items i ON ri.item_id = i.id
      WHERE ri.req_id = ?
    `, [reqData.id]);

    reqData.items = items;
    res.json(reqData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
