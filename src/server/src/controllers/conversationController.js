// src/controllers/conversationController.js - בקר לניהול שיחות
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const advisorNetworkSystem = require('../ai-orchestrator/advisorNetworkSystem');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const ChatPromptBuilder = require('../ai-orchestrator/chatPromptBuilder');
const {
  recordAdvisorSummary,
  handleAdvisorResponse
} = require('../utils//advisorSummaryTools');

/**
 * עריכת הודעה קיימת ויצירת תשובה חדשה
 * @param {Object} req - בקשת HTTP
 * @param {Object} req.body - גוף הבקשה
 * @param {string} req.body.message - תוכן ההודעה המעודכן
 * @param {string} req.body.conversationId - מזהה השיחה
 * @param {string} req.body.originalMessageId - מזהה ההודעה המקורית למחיקה
 * @param {string} req.body.systemResponseId - מזהה תשובת המערכת למחיקה (אופציונלי)
 * @param {string} req.body.advisorId - מזהה היועץ
 * @param {Object} res - תגובת HTTP
 */
exports.editMessage = async (req, res) => {
  try {
    const { 
      message, 
      conversationId, 
      originalMessageId, 
      systemResponseId, 
      advisorId 
    } = req.body;

    // בדיקת תקינות הפרמטרים
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation ID is required' });
    }

    // בדיקה שהשיחה קיימת
    let conversation;
    try {
      conversation = await Conversation.findById(conversationId);
    } catch (err) {
      logger.error(`Invalid conversation ID format: ${conversationId}`);
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }

    if (!conversation) {
      logger.error(`Conversation not found with ID: ${conversationId}`);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // מחיקת ההודעות הקודמות מהדאטאבייס
    if (originalMessageId) {
      try {
        // מחיקה מהדאטאבייס
        const deletedMessage = await Message.findByIdAndDelete(originalMessageId);
        
        if (deletedMessage) {
          logger.debug(`Deleted original user message: ${originalMessageId}`);
          
          // מחיקה מאובייקט השיחה
          // 1. זיהוי אינדקס ההודעה במערך messagss
          const messageIndex = conversation.messages.findIndex(
            msgId => msgId.toString() === originalMessageId
          );
          
          // 2. אם נמצא, הסר ממערך ה-messages
          if (messageIndex !== -1) {
            conversation.messages.splice(messageIndex, 1);
            logger.debug(`Removed message from conversation.messages array at index ${messageIndex}`);
          } else {
            logger.warn(`Could not find message with ID ${originalMessageId} in conversation.messages array`);
          }
        } else {
          logger.warn(`Message with ID ${originalMessageId} not found in database`);
        }
      } catch (err) {
        logger.error(`Error deleting original message: ${err.message}`);
      }
    }

    if (systemResponseId) {
      try {
        // מחיקה מהדאטאבייס
        const deletedResponse = await Message.findByIdAndDelete(systemResponseId);
        
        if (deletedResponse) {
          logger.debug(`Deleted system response: ${systemResponseId}`);
          
          // מחיקה מאובייקט השיחה
          // 1. זיהוי אינדקס ההודעה במערך messages
          const responseIndex = conversation.messages.findIndex(
            msgId => msgId.toString() === systemResponseId
          );
          
          // 2. אם נמצא, הסר ממערך ה-messages
          if (responseIndex !== -1) {
            conversation.messages.splice(responseIndex, 1);
            logger.debug(`Removed response from conversation.messages array at index ${responseIndex}`);
          } else {
            logger.warn(`Could not find response with ID ${systemResponseId} in conversation.messages array`);
          }
        } else {
          logger.warn(`Response with ID ${systemResponseId} not found in database`);
        }
      } catch (err) {
        logger.error(`Error deleting system response: ${err.message}`);
      }
    }

    // שמירת הודעת המשתמש החדשה
    const userMessage = new Message({
      conversationId: conversation._id,
      text: message,
      sender: 'user'
    });
    await userMessage.save();

    // עדכון השיחה עם ההודעה החדשה
    conversation.messages.push(userMessage._id);
    conversation.lastActivity = Date.now();
    await conversation.save();

    // אם נשלח מזהה יועץ מהלקוח, עדכן את היועץ הנוכחי בשיחה
    if (advisorId) {
      conversation.state.currentAdvisor = advisorId;
      await conversation.save();
      logger.debug(`Using client-specified advisor for edited message: ${advisorId}`);
    }

    // שליחת ההודעה למנהל הסוכנים של LangChain
    logger.trackConversation('user-edited-message', { text: message });

    const messages = conversation.messages || [];
    const response = await advisorNetworkSystem.processMessage(conversation, messages, message);
    
    // שמירת תשובת המערכת
    const systemMessage = new Message({
      conversationId: conversation._id,
      text: response.text,
      sender: 'system',
      advisorId: response.advisorId,
      metadata: {
        processingTime: response.processingTime,
        tokens: response.tokens,
        model: response.model,
        temperature: response.temperature,
        // הוספת מידע על מעבר בין יועצים אם קיים
        advisorTransition: response.nextAdvisor ? {
          fromAdvisorId: conversation.state.currentAdvisor,
          toAdvisorId: response.nextAdvisor.advisorId,
          reason: response.nextAdvisor.reason
        } : null,
        // הוספת מידע על הפעלת "העצמי העתידי" אם קיים
       /*  futureSelfActivation: response.futureSelfActivation ? {
          activated: response.futureSelfActivation.activate,
          ageInFuture: response.futureSelfActivation.ageInFuture,
          context: response.futureSelfActivation.context
        } : null */
      }
    });
    await systemMessage.save();

    // עדכון השיחה עם תשובת המערכת
    conversation.messages.push(systemMessage._id);
    conversation.lastActivity = Date.now();
    
    // טיפול במעבר בין יועצים אם נדרש
    if (response.nextAdvisor && response.nextAdvisor.advisorId) {
      if (conversation.state.currentAdvisor !== response.nextAdvisor.advisorId) {
        if (!conversation.state.previousAdvisors) {
          conversation.state.previousAdvisors = [];
        }
        
        if (!conversation.state.previousAdvisors.includes(conversation.state.currentAdvisor)) {
          conversation.state.previousAdvisors.push(conversation.state.currentAdvisor);
        }
        
        conversation.state.currentAdvisor = response.nextAdvisor.advisorId;
        
        logger.debug(`Advisor transition after edit: ${conversation.state.previousAdvisors[conversation.state.previousAdvisors.length - 1]} -> ${conversation.state.currentAdvisor}`);
      }
    }
    
    // חשוב: לסמן ל-Mongoose שה-state השתנה
    conversation.markModified('state');

    try {
      await conversation.save();
      logger.debug(`✅ Conversation saved after edit. currentAdvisor: ${conversation.state.currentAdvisor}`);
    } catch (saveError) {
      logger.error('Error saving conversation after edit:', saveError);
    }
    
    logger.trackConversation('advisor-message-after-edit', { 
      text: response.text, 
      advisorId: response.advisorId 
    });

    // הוספת מידע על היועץ בתשובה
    const advisorInfo = response.advisorId ? {
      id: response.advisorId,
      name: advisorNetworkSystem.getAdvisorName(response.advisorId),
      icon: advisorNetworkSystem.getAdvisorIcon(response.advisorId)
    } : null;

    // החזרת התשובה ללקוח עם מידע מורחב
    return res.json({
      success: true,
      response: {
        _id: systemMessage._id.toString(), // הוספת המזהה של ההודעה
        text: response.text,
        sender: 'system',
        advisorId: response.advisorId,
        advisorInfo: advisorInfo,
      }
    });
  } catch (error) {
    logger.error('Error in editMessage controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
   * עיבוד הודעה מהמשתמש וקבלת תשובה מהיועץ המתאים
   */
exports.generateTitle = async (req, res) => {
  try {
    const { message, conversationId, userId, advisorId } = req.body;

    const response = await advisorNetworkSystem.generateTitle(message, conversation, advisorId);

    return response.content.trim();
  } catch (error) {
    console.error('Error generating title with LLM:', error.message);
    return 'שיחה פיננסית';
  }
}


// שליחת הודעה ליועצים וקבלת תשובה
exports.sendMessage = async (req, res) => {
  try {
    const { message, conversationId, userId, advisorId } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation ID is required' });
    }

    // בדיקה שהשיחה קיימת
    let conversation;
    let messages;
    try {
      conversation = await Conversation.findById(conversationId);
      messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    } catch (err) {
      logger.error(`Invalid conversation ID format: ${conversationId}`);
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }

    if (!conversation) {
      logger.error(`Conversation not found with ID: ${conversationId}`);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // השרת הוא ה-source of truth ליועץ הנוכחי.
    // רק אם הלקוח שולח advisorId שונה מהשמור בשיחה, נעדכן (מעבר ידני של המשתמש).
    if (advisorId && advisorId !== conversation.state.currentAdvisor) {
      logger.debug(`Manual advisor switch by client: ${conversation.state.currentAdvisor} → ${advisorId}`);
      conversation.state.currentAdvisor = advisorId;
      conversation.markModified('state');
      await conversation.save();
    } else {
      logger.debug(`Current advisor from DB: ${conversation.state.currentAdvisor}`);
    }

    // שמירת הודעת המשתמש
    const userMessage = new Message({
      conversationId: conversation._id,
      text: message,
      sender: 'user'
    });

    logger.debug(`message from user : ${message}`);

    await userMessage.save();

    // עדכון השיחה עם ההודעה החדשה
    conversation.messages.push(userMessage._id);
    conversation.lastActivity = Date.now();
    await conversation.save();

    // שליחת ההודעה למנהל הסוכנים של LangChain
    //logger.trackConversation('user-message', { text: message });
    
    const response = await advisorNetworkSystem.processMessage(conversation,messages,message);
    
    // שמירת תשובת המערכת
    const systemMessage = new Message({
      conversationId: conversation._id,
      text: response.text,
      sender: 'system',
      advisorId: response.advisorId,
      metadata: {
        processingTime: response.processingTime,
        tokens: response.tokens,
        model: response.model,
        temperature: response.temperature,
        // הוספת מידע על מעבר בין יועצים אם קיים
        advisorTransition: response.nextAdvisor ? {
          fromAdvisorId: conversation.state.currentAdvisor,
          toAdvisorId: response.nextAdvisor.advisorId,
          reason: response.nextAdvisor.reason
        } : null,
      }
    });
    await systemMessage.save();

    // עדכון השיחה עם תשובת המערכת
    conversation.messages.push(systemMessage._id);
    conversation.lastActivity = Date.now();
    
    // טיפול במעבר בין יועצים אם נדרש
    if (response.nextAdvisor && response.nextAdvisor.advisorId) {
      const current = conversation.state.currentAdvisor;
      const next = response.nextAdvisor.advisorId;
    
      // רק אם אכן מדובר במעבר
      if (current !== next) {
        // שלב ראשון: שמירה על הסיכום עם היועץ הנוכחי
        handleAdvisorResponse(response, conversation, current);
    
        // ניהול היסטוריית יועצים
        conversation.state.previousAdvisors = conversation.state.previousAdvisors || [];
        if (!conversation.state.previousAdvisors.includes(current)) {
          conversation.state.previousAdvisors.push(current);
        }
    
        // עדכון היועץ הנוכחי
        conversation.state.currentAdvisor = next;
    
        // לוג
      
      logger.debug(`Advisor transition: ${current} -> ${next}`);  }
    }
   
    // חשוב: לסמן ל-Mongoose שה-state השתנה (processMessage משנה state.currentAdvisor)
    conversation.markModified('state');

    try {
      await conversation.save();
      logger.debug(`✅ Conversation saved. currentAdvisor: ${conversation.state.currentAdvisor}`);
    } catch (saveError) {
      logger.error('Error saving conversation, attempting to fix data structure:', saveError);
    }

    // הוספת מידע על היועץ בתשובה
    const advisorInfo = response.advisorId ? {
      id: response.advisorId,
      name: advisorNetworkSystem.getAdvisorName(response.advisorId),
      icon: advisorNetworkSystem.getAdvisorIcon(response.advisorId)
    } : null;

    // החזרת התשובה ללקוח עם מידע מורחב
    return res.json({
      success: true,
      response: {
        text: response.text,
        sender: 'system',
        advisorId: response.advisorId,
        advisorInfo: advisorInfo,
        nextAdvisor: response.nextAdvisor
      }
    });
  } catch (error) {
    logger.error('Error in sendMessage controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// יצירת שיחה חדשה - הגדרה רחבה יותר של מבנה הנתונים
exports.createConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // בדיקה האם הערך הוא מזהה תקין או מחרוזת אנונימית
    let actualUserId = userId;
    
    // אם המזהה מתחיל ב-'anonymous-', נשתמש בו כמחרוזת
    if (typeof userId === 'string' && userId.startsWith('anonymous-')) {
      // המזהה כבר במבנה הנכון, אפשר להשתמש בו כמו שהוא
      actualUserId = userId;
    } else {
      try {
        // ננסה להמיר ל-ObjectId אם זה אפשרי
        actualUserId = new mongoose.Types.ObjectId(userId);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid user ID format' 
        });
      }
    }

    // יצירת כותרת דינמית
    const dateObj = new Date();
    const hebrewDate = new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(dateObj);
    
    // בחירה רנדומלית של כותרת מתוך אוסף אפשרויות
    const titleOptions = [
      `תוכנית פיננסית - ${hebrewDate}`,
      `מפגש ייעוץ פיננסי ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`,
      `צעדים לעצמאות פיננסית`,
      `תוכנית עבודה פיננסית`,
      `מסע לביטחון כלכלי`,
      `תיק ייעוץ אישי`,
      `דרכך לחופש פיננסי`,
      `תכנון פיננסי ${dateObj.getFullYear()}`,
      `מפת דרכים לעתיד כלכלי`,
      `תוכנית צמיחה פיננסית`
    ];

    const randomTitle = titleOptions[Math.floor(Math.random() * titleOptions.length)];

    // יצירת שיחה עם מבנה נתונים מורחב
    const conversation = new Conversation({
      userId: actualUserId,
      title: randomTitle,
      context: {
        userProfile: {},
        financialInfo: {},
        goals: [],
        concerns: [],
        triggers: {
          advisorTriggers: {}
        }
      },
      state: {
        currentAdvisor: 'strategy',
        previousAdvisors: [],
        pendingAdvisors: [],
        conversationPhase: 'initial-mapping',
        specialMode: null,  // אפשרות למצבים מיוחדים כמו 'future-self'
        futureSelfContext: null  // הקשר ל"עצמי העתידי" אם מופעל
      },
      // וידוא שמבנה ציוני מפ"ל קיים 
      mfplScores: {
        initial: {},
        current: {}
      },
      recommendations: []
    });
    
    await conversation.save();

    const conversationId = conversation._id.toString();

    // אתחול השיחה עם היועץ הראשי
    const initResult = await advisorNetworkSystem.initializeConversation(
        conversationId,
        conversation.context.userProfile
    );

    // שמירת הודעת הפתיחה של היועץ הראשי כהודעה במסד הנתונים
    if (initResult.userIntroMessage) {
      const welcomeMessage = new Message({
        conversationId: conversation._id,
        text: initResult.userIntroMessage,
        sender: 'system',
        advisorId: 'strategy',
        metadata: {
          isWelcomeMessage: true
        }
      });
      await welcomeMessage.save();

      // הוספת ההודעה לשיחה
      conversation.messages.push(welcomeMessage._id);
      await conversation.save();
    }

    if (initResult.advisor) {
        conversation.state.currentAdvisor = initResult.advisor;
        await conversation.save();
    }

    res.status(201).json({
      success: true,
      conversation,
      init: {
        ...initResult,
        userIntroMessage: initResult.userIntroMessage
      }
    });
  } catch (error) {
    logger.error('Error in createConversation controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// פתרון 2: אם אתה רוצה לשמור על המודל הקיים עם ObjectId בלבד
exports.createConversation_alternative = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // במקרה של משתמש אנונימי, צור מזהה אקראי תקין
    let actualUserId;
    if (typeof userId === 'string' && userId.startsWith('anonymous-')) {
      // יצירת ObjectId אקראי חדש
      const mongoose = require('mongoose');
      actualUserId = new mongoose.Types.ObjectId();
      
      // אם תרצה, שמור את המזהה האנונימי במקום אחר בדוקומנט
      const conversation = new Conversation({
        userId: actualUserId,
        anonymousId: userId,  // הוסף שדה חדש לשמירת המזהה האנונימי
        title: "שיחה חדשה",
        // יתר השדות...
      });
      
      await conversation.save();
      res.status(201).json({ success: true, conversation });
    } else {
      // טיפול במזהה רגיל
      try {
        const mongoose = require('mongoose');
        actualUserId = new mongoose.Types.ObjectId(userId);
        
        const conversation = new Conversation({
          userId: actualUserId,
          title: "שיחה חדשה",
          // יתר השדות...
        });
        
        await conversation.save();
        res.status(201).json({ success: true, conversation });
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid user ID format' 
        });
      }
    }
  } catch (error) {
    logger.error('Error in createConversation controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// קבלת היסטוריית שיחה עם תמיכה במודל המורחב
exports.getConversationHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // בדיקה שהמזהה תקין
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }
    
    // מציאת השיחה וטעינת ההודעות המקושרות
    const conversation = await Conversation.findById(id).populate('messages');
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    // המרת ההודעות לפורמט מורחב הכולל מידע על היועצים
    const messages = conversation.messages.map(msg => {
      const msgObj = {
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.createdAt
      };
      
      // הוספת מידע על היועץ אם זו הודעת מערכת
      if (msg.sender === 'system' && msg.advisorId) {
        msgObj.advisorId = msg.advisorId;
        msgObj.advisorInfo = {
          id: msg.advisorId,
          name: advisorNetworkSystem.getAdvisorName(msg.advisorId),
          icon: advisorNetworkSystem.getAdvisorIcon(msg.advisorId)
        };
      }
      
      // הוספת מידע על מעבר בין יועצים אם קיים
      if (msg.metadata && msg.metadata.advisorTransition) {
        msgObj.advisorTransition = msg.metadata.advisorTransition;
      }
      
      // הוספת מידע על מצב "העצמי העתידי" אם קיים
      if (msg.metadata && msg.metadata.futureSelfActivation) {
        msgObj.futureSelfActivation = msg.metadata.futureSelfActivation;
      }
      
      return msgObj;
    });
    
    res.json({ 
      success: true,
      conversation: {
        id: conversation._id,
        title: conversation.title,
        messages: messages,
        startedAt: conversation.startedAt,
        lastActivity: conversation.lastActivity,
        //mfplScores: conversation.mfplScores,
        state: conversation.state,
        //recommendations: conversation.recommendations,
        context: {
          userProfile: conversation.context.userProfile,
          //goals: conversation.context.goals,
          //concerns: conversation.context.concerns
        }
      }
    });
  } catch (error) {
    logger.error('Error in getConversationHistory controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.deleteMessageFromConversation = async (req, res) => {
  const { conversationId, messageId } = req.params;
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // מחיקה לפי מזהה
    conversation.messages = conversation.messages.filter(m => m._id.toString() !== messageId);

    await conversation.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// מחיקת שיחה
exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // בדיקה שהמזהה תקין
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }
    
    // מציאת השיחה
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    // מחיקת כל ההודעות הקשורות
    await Message.deleteMany({ conversationId: id });
    
    // מחיקת השיחה עצמה
    await conversation.deleteOne();
    
    res.json({ success: true, message: 'Conversation and related messages deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteConversation controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};



// קבלת דו"ח מסכם על השיחה
exports.getConversationSummary = async (req, res) => {
  try {
    const { id } = req.params;
    
    // בדיקה שהמזהה תקין
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }
    
    // מציאת השיחה
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    // יצירת דו"ח מסכם באמצעות שירות האורקסטרטור
    const summary = await orchestratorService.generateConversationSummary(conversation);
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error('Error in getConversationSummary controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// יצירת תכנית פעולה
exports.createActionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    // בדיקה שהמזהה תקין
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }
    
    // מציאת השיחה
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    // יצירת תכנית פעולה באמצעות שירות האורקסטרטור
    const actionPlan = await orchestratorService.generateActionPlan(conversation);
    
    // עדכון השיחה עם תכנית הפעולה החדשה
    conversation.actionPlan = {
      created: true,
      steps: actionPlan.steps
    };
    
    await conversation.save();
    
    res.json({
      success: true,
      actionPlan
    });
  } catch (error) {
    logger.error('Error in createActionPlan controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// עדכון סטטוס פעולה בתכנית
exports.updateActionStatus = async (req, res) => {
  try {
    const { id, actionId } = req.params;
    const { completed } = req.body;
    
    // בדיקה שהמזהה תקין
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }
    
    // מציאת השיחה
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    // בדיקה שיש תכנית פעולה
    if (!conversation.actionPlan || !conversation.actionPlan.created) {
      return res.status(404).json({ success: false, error: 'No action plan found for this conversation' });
    }
    
    // מציאת הפעולה הספציפית
    const actionIndex = conversation.actionPlan.steps.findIndex(step => step._id.toString() === actionId);
    
    if (actionIndex === -1) {
      return res.status(404).json({ success: false, error: 'Action not found in the action plan' });
    }
    
    // עדכון סטטוס הפעולה
    conversation.actionPlan.steps[actionIndex].completed = completed;
    
    await conversation.save();
    
    res.json({
      success: true,
      message: `Action status updated to ${completed ? 'completed' : 'not completed'}`,
      actionPlan: conversation.actionPlan
    });
  } catch (error) {
    logger.error('Error in updateActionStatus controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// תוספות למודול conversationController.js

/**
 * קבלת רשימת שיחות של משתמש
 */
exports.getUserConversations = async (req, res) => {
  try {
    // קבלת המזהה של המשתמש, או מהטוקן (אם יש אותנטיקציה) או מפרמטר
    const userId = req.query.userId || req.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    // מציאת כל השיחות של המשתמש - נשתמש בתנאי מיוחד לתמיכה גם במזהה רגיל וגם באנונימי
    const isAnonymous = typeof userId === 'string' && userId.startsWith('anonymous-');
    
    // בניית תנאי חיפוש מותאם
    let query = {};
    
    if (isAnonymous) {
      // חיפוש לפי מזהה אנונימי
      query = { userId };
    } else {
      try {
        // נסיון המרה ל-ObjectId אם זה לא מזהה אנונימי
        const mongoose = require('mongoose');
        const objectId = new mongoose.Types.ObjectId(userId);
        query = { userId: objectId };
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Invalid user ID format' });
      }
    }
    
    // שליפת רשימת שיחות מסודרת לפי התאריך האחרון
    const conversations = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .populate({
        path: 'messages',
        options: { 
          limit: 10,  // לוקח רק את 10 ההודעות האחרונות מכל שיחה
          sort: { createdAt: -1 } 
        }
      })
      .lean();
    
    // עיבוד הנתונים לפורמט הנדרש
    const processedConversations = conversations.map(conversation => {
      // סידור ההודעות לפי סדר כרונולוגי
      const messages = conversation.messages || [];
      messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      return {
        _id: conversation._id,
        title: conversation.title || 'שיחה חדשה',
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt || conversation.lastActivity,
        messages: messages.map(msg => ({
          text: msg.text,
          sender: msg.sender,
          advisorId: msg.advisorId,
          timestamp: msg.createdAt
        })),
        context: conversation.context ? {
          userProfile: conversation.context.userProfile || {},
          goals: conversation.context.goals || [],
          concerns: conversation.context.concerns || []
        } : {},
        mfplScores: conversation.mfplScores || {},
        state: {
          currentAdvisor: conversation.state?.currentAdvisor,
          conversationPhase: conversation.state?.conversationPhase,
          specialMode: conversation.state?.specialMode
        }
      };
    });
    
    res.json({
      success: true,
      conversations: processedConversations
    });
  } catch (error) {
    logger.error('Error in getUserConversations controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * עדכון פרטי שיחה (כותרת)
 */
exports.updateConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    // בדיקה שהמזהה תקין
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }
    
    // בדיקה שהכותרת תקינה
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Valid title is required' });
    }
    
    // מציאת השיחה ועדכון הכותרת
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    // עדכון הכותרת
    conversation.title = title.trim();
    
    // שמירת השינויים
    await conversation.save();
    
    res.json({
      success: true,
      message: 'Conversation title updated successfully',
      conversation: {
        _id: conversation._id,
        title: conversation.title
      }
    });
  } catch (error) {
    logger.error('Error in updateConversation controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
