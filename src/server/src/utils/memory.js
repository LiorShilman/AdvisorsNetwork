// src/utils/memory.js - מנהל זיכרון השיחות
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const config = require('../../configs/config');
const logger = require('./logger');

/**
 * מחלקה לניהול זיכרון וקונטקסט של שיחות
 */
class MemoryManager {
  constructor() {
    // מידע בזיכרון הזמני (Runtime)
    this.conversationHistory = {};

    // הגבלת מספר הודעות מקסימלי בזיכרון
    this.maxMessages = config.langchain.memory.maxTokenLimit || 10000;
    
    // טוקן ממוצע לתו (הערכה גסה)
    this.tokensPerChar = 0.25;
  }

  /**
   * שליפת היסטוריית שיחה
   * @param {string} conversationId - מזהה השיחה
   * @returns {Promise<Array>} - היסטוריית השיחה
   */
  async getConversationHistory(conversationId) {
    // אם זיכרון השיחה לא קיים, נאתחל מערך ריק
    if (!this.conversationHistory[conversationId]) {
      this.conversationHistory[conversationId] = [];
    }
    
    return this.conversationHistory[conversationId];
  }

  /**
   * הוספת חילופי הודעות לזיכרון השיחה
   * @param {string} conversationId - מזהה השיחה
   * @param {HumanMessage} humanMessage - הודעת המשתמש
   * @param {AIMessage} aiMessage - הודעת המערכת
   */
  async addToHistory(conversationId, humanMessage, aiMessage) {
    // אם זיכרון השיחה לא קיים, נאתחל אותו
    if (!this.conversationHistory[conversationId]) {
      this.conversationHistory[conversationId] = [];
    }
    
    // הוספת ההודעות החדשות
    this.conversationHistory[conversationId].push(humanMessage);
    this.conversationHistory[conversationId].push(aiMessage);
    
    // בדיקה אם חרגנו ממגבלת הטוקנים
    if (this.estimateTokens(conversationId) > this.maxMessages) {
      logger.debug(`Conversation ${conversationId} exceeds token limit, pruning older messages`);
      this.pruneConversation(conversationId);
    }
  }

  /**
   * ניקוי הודעות ישנות מהזיכרון כאשר חורגים ממגבלת הטוקנים
   * @param {string} conversationId - מזהה השיחה
   */
  pruneConversation(conversationId) {
    const history = this.conversationHistory[conversationId];
    if (!history || history.length <= 2) return;
    
    // שמירה על ההודעה הראשונה (הקשר) וההודעות האחרונות
    const keepFirst = 2; // נשמור את ההודעות הראשונות (הקשר ראשוני)
    const keepLast = 8; // נשמור את 8 ההודעות האחרונות (4 מחזורי שאלה-תשובה)
    
    if (history.length > keepFirst + keepLast) {
      this.conversationHistory[conversationId] = [
        ...history.slice(0, keepFirst),
        ...history.slice(-keepLast)
      ];
      
      // הוספת הודעת מערכת בין הקבוצות
      if (keepFirst > 0 && keepLast > 0) {
        this.conversationHistory[conversationId].splice(keepFirst, 0, 
          new AIMessage("(חלק מההיסטוריה הושמט לשמירה על הקשר רלוונטי)")
        );
      }
    }
  }

  /**
   * הערכת מספר הטוקנים בשיחה
   * @param {string} conversationId - מזהה השיחה
   * @returns {number} - הערכת מספר הטוקנים
   */
  estimateTokens(conversationId) {
    const history = this.conversationHistory[conversationId];
    if (!history) return 0;
    
    // חישוב הערכה גסה של מספר התווים בכל ההודעות
    let totalChars = 0;
    for (const message of history) {
      totalChars += (message.content?.length || 0);
    }
    
    // המרה לטוקנים (הערכה גסה)
    return Math.ceil(totalChars * this.tokensPerChar);
  }

  /**
   * ניקוי זיכרון השיחה
   * @param {string} conversationId - מזהה השיחה
   */
  async clearHistory(conversationId) {
    if (this.conversationHistory[conversationId]) {
      this.conversationHistory[conversationId] = [];
    }
  }

  /**
   * ייצוא היסטוריית השיחה לשמירה בבסיס הנתונים
   * @param {string} conversationId - מזהה השיחה
   * @returns {Array} - היסטוריית השיחה במבנה לשמירה
   */
  async exportConversation(conversationId) {
    const history = this.conversationHistory[conversationId];
    if (!history) return [];
    
    return history.map(message => ({
      role: message._getType() === 'human' ? 'user' : 'system',
      content: message.content
    }));
  }

  /**
   * ייבוא היסטוריית שיחה מבסיס הנתונים
   * @param {string} conversationId - מזהה השיחה
   * @param {Array} messages - הודעות השיחה
   */
  async importConversation(conversationId, messages) {
    this.conversationHistory[conversationId] = [];
    
    for (const message of messages) {
      if (message.role === 'user') {
        this.conversationHistory[conversationId].push(new HumanMessage(message.content));
      } else {
        this.conversationHistory[conversationId].push(new AIMessage(message.content));
      }
    }
  }
}

module.exports = { MemoryManager };