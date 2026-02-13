// conversationStageManager.js
const { extractTextFromMessage } = require('./../utils/messageUtils');

class ConversationStageManager {


  /**
   * מזהה את שלב השיחה הנוכחי לפי ההיסטוריה
   * @param {Array<{ role: string, content: string, questionKey?: string }>} history 
   * @param {object} advisor 
   * @returns {'intro' | 'active' | 'ready_for_summary' | 'need_clarification'}
   */
  detectConversationStage(history, advisor) {
    if (!history || history.length === 0) return 'intro';

    const lastUserMessage = [...history].reverse().find(msg => msg.role === 'user')?.content || '';
    const lastUserText = extractTextFromMessage(lastUserMessage);
    // בדיקת מילות מפתח לשלב הסיכום
    const summaryTriggers = ['סיכום', 'מה לעשות עכשיו', 'אז מה ההמלצה', 'אפשר לקבל כיוון'];
    if (summaryTriggers.some(phrase => lastUserText.includes(phrase))) {
      return 'ready_for_summary';
    }

    const clarificationTriggers = ['לא הבנתי', 'מה זה אומר', 'תסביר שוב'];
    if (clarificationTriggers.some(phrase => lastUserText.includes(phrase))) {
      return 'need_clarification';
    }

    // בדיקה אם כל השאלות נענו
    const answeredKeys = history
      .filter(m => m.role === 'user' && m.questionKey)
      .map(m => m.questionKey);

    const allKeys = advisor.keyQuestions?.map(q => q.key) || [];
    const allAnswered = allKeys.every(k => answeredKeys.includes(k));

    if (allAnswered) return 'ready_for_summary';

    return 'active';
  }
}

module.exports = new ConversationStageManager();
