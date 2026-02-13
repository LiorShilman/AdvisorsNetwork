// src/routes/conversationRoutes.js - ניתובי API לשיחות
const express = require('express');
const conversationController = require('../../controllers/conversationController');

const router = express.Router();

router.get('/', conversationController.getUserConversations);

// ניתוב לעריכת הודעה ותשובת מערכת
router.post('/edit', conversationController.editMessage);

// ניתוב לשליחת הודעה ליועצים
router.post('/', conversationController.sendMessage);

router.post('/generate-title', conversationController.generateTitle);

// ניתוב ליצירת שיחה חדשה
router.post('/create', conversationController.createConversation);

// ניתוב לקבלת היסטוריית שיחה
router.get('/:id', conversationController.getConversationHistory);

router.patch('/:id', conversationController.updateConversation);

router.delete('/:conversationId/message/:messageId', conversationController.deleteMessageFromConversation);



// ניתוב למחיקת שיחה
router.delete('/:id', conversationController.deleteConversation);

// ניתוב לקבלת דו"ח מסכם על השיחה
router.get('/:id/summary', conversationController.getConversationSummary);

// ניתוב להוספת תכנית פעולה
router.post('/:id/action-plan', conversationController.createActionPlan);

// ניתוב לעדכון סטטוס פעולה בתכנית
router.patch('/:id/action-plan/:actionId', conversationController.updateActionStatus);

module.exports = router;