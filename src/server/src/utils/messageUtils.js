// 📁 messageUtils.js – כלי עזר לעבודה עם הודעות
const { HumanMessage, SystemMessage, AIMessage, BaseMessage } = require('@langchain/core/messages');

/**
 * מחלץ טקסט נקי מתוך אובייקט הודעה (user או assistant)
 * תומך במבנים שונים: string או { text }
 *
 * @param {object} message - הודעה בודדת מהיסטוריית השיחה
 * @returns {string} - טקסט רגיל לשימוש
 */
function extractTextFromMessage(message) {
    if (!message || typeof message !== 'object') return '';
    if (typeof message.content === 'string') return message.content;
    if (typeof message.content?.text === 'string') return message.content.text;
    return '';
  }

function toLangchainMessages(messages) {
          return messages.map(m => {
              if (m instanceof BaseMessage) return m;
  
              if (m.role === 'user') return new HumanMessage(m.content);
              if (m.role === 'assistant') return new AIMessage(m.content);
              if (m.role === 'system') return new SystemMessage(m.content);
  
              throw new Error(`Unknown or missing role in message: ${JSON.stringify(m)}`);
          });
      }

  
  module.exports = {
    extractTextFromMessage,
    toLangchainMessages
  };
  