const express = require('express');
const router = express.Router();
const { sqliteQuery } = require('../db');

// GL Report (Monthly or Yearly)
router.get('/gl', async (req, res) => {
  const { year, month } = req.query;
  if (!year) return res.status(400).json({ error: "Year is required" });

  try {
    const items = await sqliteQuery.all('SELECT * FROM non_drug_items');
    
    // Group items by category
    const categories = {};
    for (const item of items) {
      const cat = item.report_category || 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์';
      if (!categories[cat]) categories[cat] = {
        category_name: cat,
        beginning_value: 0,
        received_value: 0,
        total_value: 0,
        dispensed_value: 0,
        remaining_value: 0,
        item_ids: []
      };
      categories[cat].item_ids.push(item.id);
    }

    if (month) {
      // Monthly Report
      const stocks = await sqliteQuery.all(
        'SELECT * FROM non_drug_monthly_stock WHERE fiscal_year = ? AND month_name = ?',
        [year, month]
      );
      
      const stockMap = {};
      for (const s of stocks) {
        stockMap[s.item_id] = s;
      }

      for (const item of items) {
        const cat = item.report_category || 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์';
        const s = stockMap[item.id];
        
        const beg = s ? (s.beginning_balance * item.unit_price) : 0;
        const rec = s ? s.received_value : 0;
        const disp = s ? s.dispensed_value : 0;
        const rem = s ? s.remaining_value : 0;

        categories[cat].beginning_value += beg;
        categories[cat].received_value += rec;
        categories[cat].dispensed_value += disp;
        categories[cat].remaining_value += rem;
      }
    } else {
      // Yearly Report
      const stocks = await sqliteQuery.all(
        'SELECT * FROM non_drug_monthly_stock WHERE fiscal_year = ?',
        [year]
      );

      // Group stocks by item_id
      const itemStocks = {};
      for (const s of stocks) {
        if (!itemStocks[s.item_id]) itemStocks[s.item_id] = [];
        // Map Thai months to numbers for sorting chronologically
        const monthMap = {'ต.ค.':1,'พ.ย.':2,'ธ.ค.':3,'ม.ค.':4,'ก.พ.':5,'มี.ค.':6,'เม.ย.':7,'พ.ค.':8,'มิ.ย.':9,'ก.ค.':10,'ส.ค.':11,'ก.ย.':12};
        const mParts = s.month_name.split('.');
        if (mParts.length >= 2) {
            const mPrefix = mParts[0] + '.' + mParts[1] + '.';
            s.sortKey = monthMap[mPrefix] || 0;
        } else {
            s.sortKey = 0;
        }
        itemStocks[s.item_id].push(s);
      }

      for (const item of items) {
        const cat = item.report_category || 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์';
        const sList = itemStocks[item.id] || [];
        if (sList.length > 0) {
          sList.sort((a,b) => a.sortKey - b.sortKey);
          
          const firstMonth = sList[0];
          const lastMonth = sList[sList.length - 1];
          
          const beg = firstMonth.beginning_balance * item.unit_price;
          const rec = sList.reduce((sum, s) => sum + s.received_value, 0);
          const disp = sList.reduce((sum, s) => sum + s.dispensed_value, 0);
          const rem = lastMonth.remaining_value;

          categories[cat].beginning_value += beg;
          categories[cat].received_value += rec;
          categories[cat].dispensed_value += disp;
          categories[cat].remaining_value += rem;
        }
      }
    }

    // Calculate totals and round to 2 decimals
    const result = Object.values(categories).map(cat => {
      cat.total_value = cat.beginning_value + cat.received_value;
      
      // Fix floating point precision
      cat.beginning_value = parseFloat(cat.beginning_value.toFixed(2));
      cat.received_value = parseFloat(cat.received_value.toFixed(2));
      cat.total_value = parseFloat(cat.total_value.toFixed(2));
      cat.dispensed_value = parseFloat(cat.dispensed_value.toFixed(2));
      cat.remaining_value = parseFloat(cat.remaining_value.toFixed(2));
      
      return cat;
    });

    // Sort categories alphabetically
    result.sort((a, b) => a.category_name.localeCompare(b.category_name));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
