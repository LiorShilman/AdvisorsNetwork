// src/controllers/advisorController.js - בקר לניהול יועצים
const advisorDefinitions = require('../advisors/advisorDefinitions');
//const orchestratorService = require('../services/orchestratorService');
const logger = require('../utils/logger');

// קבלת רשימת כל היועצים
exports.getAdvisors = async (req, res) => {
  try {
    // החזרת פרטי היועצים (ללא prompts ומידע פנימי)
    const advisorsForClient = {};
    
    for (const [id, advisor] of Object.entries(advisorDefinitions)) {
      advisorsForClient[id] = {
        name: advisor.name,
        icon: advisor.icon,
        color: advisor.color,
        description: advisor.description,
        role: advisor.role
      };
    }
    
    const response = { success: true, advisors: advisorsForClient };
    console.log('Server response:', JSON.stringify(response));
    res.json(response);
    
  } catch (error) {
    logger.error('Error in getAdvisors controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// קבלת מידע על יועץ ספציפי
exports.getAdvisorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // בדיקה שהיועץ קיים
    if (!advisorDefinitions[id]) {
      return res.status(404).json({ success: false, error: 'Advisor not found' });
    }
    
    const advisor = advisorDefinitions[id];
    
    // החזרת פרטי היועץ (ללא prompts ומידע פנימי)
    res.json({
      success: true,
      advisor: {
        id,
        name: advisor.name,
        icon: advisor.icon,
        color: advisor.color,
        description: advisor.description,
        role: advisor.role,
        expertise: advisor.expertise
      }
    });
  } catch (error) {
    logger.error('Error in getAdvisorById controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// התייעצות עם יועץ ספציפי
exports.consultAdvisor = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, conversationId, context } = req.body;
    
    // בדיקה שהיועץ קיים
    if (!advisorDefinitions[id]) {
      return res.status(404).json({ success: false, error: 'Advisor not found' });
    }
    
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }
    
    // קבלת תשובה מיועץ ספציפי
    const response = await orchestratorService.consultSpecificAdvisor(id, question, conversationId, context);
    
    res.json({
      success: true,
      response: {
        text: response.text,
        advisorId: id,
        recommendations: response.recommendations || []
      }
    });
  } catch (error) {
    logger.error('Error in consultAdvisor controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};