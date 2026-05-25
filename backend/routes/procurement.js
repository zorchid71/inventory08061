const express = require('express');
const router = express.Router();
const { sqliteQuery } = require('../db');

// Get Procurement Plan
router.get('/plan', async (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: "Year is required" });

  const currentYear = parseInt(year);
  const year1 = currentYear - 3;
  const year2 = currentYear - 2;
  const year3 = currentYear - 1;

  try {
    const items = await sqliteQuery.all('SELECT * FROM non_drug_items');
    
    // Get past 3 years usage (dispensed_qty sum)
    const usageQuery = `
      SELECT item_id, fiscal_year, SUM(dispensed_qty) as total_used
      FROM non_drug_monthly_stock
      WHERE fiscal_year IN (?, ?, ?)
      GROUP BY item_id, fiscal_year
    `;
    const usages = await sqliteQuery.all(usageQuery, [year1, year2, year3]);
    
    // Get latest stock for each item
    const latestStockQuery = `
      SELECT item_id, remaining_qty
      FROM non_drug_monthly_stock
      WHERE id IN (
        SELECT MAX(id) FROM non_drug_monthly_stock GROUP BY item_id
      )
    `;
    const stocks = await sqliteQuery.all(latestStockQuery);
    
    // Get existing plan
    const plans = await sqliteQuery.all('SELECT * FROM non_drug_procurement_plans WHERE fiscal_year = ?', [currentYear]);
    
    const usageMap = {};
    for (const u of usages) {
      if (!usageMap[u.item_id]) usageMap[u.item_id] = { y1: 0, y2: 0, y3: 0 };
      if (u.fiscal_year == year1) usageMap[u.item_id].y1 = u.total_used;
      if (u.fiscal_year == year2) usageMap[u.item_id].y2 = u.total_used;
      if (u.fiscal_year == year3) usageMap[u.item_id].y3 = u.total_used;
    }

    const stockMap = {};
    for (const s of stocks) {
      stockMap[s.item_id] = s.remaining_qty;
    }

    const planMap = {};
    for (const p of plans) {
      planMap[p.item_id] = p;
    }

    const result = items.map(item => {
      const u = usageMap[item.id] || { y1: 0, y2: 0, y3: 0 };
      const stock = stockMap[item.id] || 0;
      const p = planMap[item.id] || {
        estimated_usage: 0,
        q1_qty: 0, q2_qty: 0, q3_qty: 0, q4_qty: 0
      };

      return {
        ...item,
        usage_y1: u.y1,
        usage_y2: u.y2,
        usage_y3: u.y3,
        current_stock: stock,
        estimated_usage: p.estimated_usage,
        q1_qty: p.q1_qty,
        q2_qty: p.q2_qty,
        q3_qty: p.q3_qty,
        q4_qty: p.q4_qty
      };
    });

    res.json({
      years: [year1, year2, year3],
      items: result
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Procurement Plan
router.post('/plan', async (req, res) => {
  const { year, items } = req.body;
  if (!year || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    // Delete existing plan for this year
    await sqliteQuery.run('DELETE FROM non_drug_procurement_plans WHERE fiscal_year = ?', [year]);

    // Insert new plan
    for (const item of items) {
      await sqliteQuery.run(`
        INSERT INTO non_drug_procurement_plans 
        (fiscal_year, item_id, estimated_usage, q1_qty, q2_qty, q3_qty, q4_qty)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        year, 
        item.id, 
        item.estimated_usage || 0,
        item.q1_qty || 0,
        item.q2_qty || 0,
        item.q3_qty || 0,
        item.q4_qty || 0
      ]);
    }
    
    res.json({ success: true, message: "Plan saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
