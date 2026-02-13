// server.js - שרת Node.js עם Express
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('./src/utils/logger');
const apiRoutes = require('./src/models/routes/api');
const connectDB = require('./configs/db');
const config = require('./configs/config');

// יצירת אפליקציית Express
const app = express();
const PORT = config.port;

// Middleware
app.use(cors()); // אפשר CORS לחיבור מהקליינט Angular
app.use(bodyParser.json()); // לפענוח JSON בבקשות

// לוגים למידע על כל בקשה
// handling CORS
app.use((req, res, next) => {
  //res.header("Access-Control-Allow-Origin", "http://shilmanlior2608.ddns.net");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Private-Network: true");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE,OPTIONS"); // Add OPTIONS method
  next();
});

// רישום נתיבי ה-API
app.use('/api', apiRoutes);

// טיפול בשגיאות
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: config.env === 'production' ? 'Internal server error' : err.message 
  });
});

// התחלת השרת
const startServer = async () => {
  try {
    // התחברות לבסיס הנתונים אם צריך
    if (config.env !== 'test') {
      await connectDB();
    }
    
    // הפעלת השרת
    app.listen(PORT, () => {
      //logger.info(`Server running in ${config.env} mode on port http://shilmanlior2608.ddns.net:${PORT}`);
      logger.info(`Server running in ${config.env} mode on port http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// הפעלת השרת
startServer();

// ייצוא לשימוש בבדיקות
module.exports = app;