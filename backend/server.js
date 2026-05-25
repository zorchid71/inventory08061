const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { checkMysqlConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 5050;

// Enable CORS for local cross-origin development (React UI and Node API running on different ports)
app.use(cors({
  origin: '*', // Allow all origins for simple local setup
  credentials: true
}));

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const inventoryRouter = require('./routes/inventory');
const settingsRouter = require('./routes/settings');
const reportsRouter = require('./routes/reports');
const procurementRouter = require('./routes/procurement');
const purchaseRequestsRouter = require('./routes/purchase_requests');
const requisitionRouter = require('./routes/requisition');
const authRouter = require('./routes/auth');
const verifyToken = require('./middleware/auth');

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/inventory', verifyToken, inventoryRouter);
app.use('/api/settings', verifyToken, settingsRouter);
app.use('/api/reports', verifyToken, reportsRouter);
app.use('/api/procurement', verifyToken, procurementRouter);
app.use('/api/purchase_requests', verifyToken, purchaseRequestsRouter);
app.use('/api/requisitions', verifyToken, requisitionRouter);

// Serve static frontend in production (dist folder)
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  console.log("Serving React frontend from:", distPath);
  app.use(express.static(distPath));
  // Catch-all to support React SPA routing (excluding API routes)
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Health check endpoint with database connection details
app.get('/api/health', async (req, res) => {
  const mysqlConnected = await checkMysqlConnection();
  res.json({
    status: "ok",
    environment: "local",
    mysql_connected: mysqlConnected,
    database_mode: mysqlConnected ? "Live HOSxP Database" : "Simulated/Mock Database",
    auth_enabled: true
  });
});

// Start the server if not running in serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` HOSxP Local Backend running on port ${PORT}`);
    console.log(` API base URL: http://localhost:${PORT}/api`);
    console.log(`===================================================`);
  });
}

// Export for Vercel
module.exports = app;
