const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.post('/login', (req, res) => {
  const { password } = req.body;
  
  // Get admin password from Environment Variables or use default 'admin1234'
  const adminPass = process.env.ADMIN_PASSWORD || 'admin1234';
  
  if (password === adminPass) {
    // Issue token valid for 24 hours
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'smart-hosxp-secret-key-2026', { expiresIn: '24h' });
    return res.json({ success: true, token });
  }
  
  return res.status(401).json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' });
});

module.exports = router;
