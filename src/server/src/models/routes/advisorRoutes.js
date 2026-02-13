// src/routes/advisorRoutes.js - ניתובי API ליועצים
const express = require('express');
const advisorController = require('../../controllers/advisorController');

const router = express.Router();

// ניתוב לקבלת רשימת היועצים
router.get('/', advisorController.getAdvisors);

// ניתוב לקבלת מידע על יועץ ספציפי
router.get('/:id', advisorController.getAdvisorById);

// ניתוב לקבלת המלצות מיועץ ספציפי
router.post('/:id/consult', advisorController.consultAdvisor);

module.exports = router;