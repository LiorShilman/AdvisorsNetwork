// src/routes/api.js - נקודת כניסה ראשית ל-API
const express = require('express');
const conversationRoutes = require('./conversationRoutes');
const advisorRoutes = require('./advisorRoutes');

const router = express.Router();

// בדיקת תקינות השרת
router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// רישום נתיבי משנה
router.use('/conversations', conversationRoutes);
router.use('/advisors', advisorRoutes);

module.exports = router;