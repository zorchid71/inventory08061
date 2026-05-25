const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  // Allow OPTIONS preflight requests
  if (req.method === 'OPTIONS') return next();
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'ไม่พบข้อมูลยืนยันตัวตน (No token provided)' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'smart-hosxp-secret-key-2026', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'ข้อมูลยืนยันตัวตนไม่ถูกต้องหรือหมดอายุ (Unauthorized)' });
    req.user = decoded;
    next();
  });
}

module.exports = verifyToken;
