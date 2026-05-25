const express = require('express');
const router = express.Router();
const { sqliteQuery } = require('../db');

// List all purchase requests
router.get('/', async (req, res) => {
  try {
    const rows = await sqliteQuery.all('SELECT * FROM purchase_requests ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific purchase request with items
router.get('/:id', async (req, res) => {
  try {
    const request = await sqliteQuery.get('SELECT * FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ error: "Not found" });

    const items = await sqliteQuery.all(`
      SELECT pri.*, i.name, i.unit, i.pack_size 
      FROM purchase_request_items pri
      JOIN non_drug_items i ON pri.item_id = i.id
      WHERE pri.purchase_request_id = ?
    `, [req.params.id]);

    res.json({ ...request, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new purchase request
router.post('/', async (req, res) => {
  const { doc_no, doc_date, items } = req.body;
  
  if (!doc_date || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing required fields or items" });
  }

  try {
    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);

    const result = await sqliteQuery.run(
      'INSERT INTO purchase_requests (doc_no, doc_date, total_amount) VALUES (?, ?, ?)',
      [doc_no || '', doc_date, totalAmount]
    );

    const prId = result.lastID;

    // Insert items
    for (const item of items) {
      await sqliteQuery.run(
        'INSERT INTO purchase_request_items (purchase_request_id, item_id, qty, unit_price) VALUES (?, ?, ?, ?)',
        [prId, item.id, item.qty, item.unit_price]
      );
    }

    res.json({ success: true, id: prId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a purchase request
router.delete('/:id', async (req, res) => {
  try {
    await sqliteQuery.run('DELETE FROM purchase_requests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
