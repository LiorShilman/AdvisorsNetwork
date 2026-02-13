/**
 * מודול ניהול סיכום יועצים – כולל שמירת ממצאים ועדכון handoff
 * מתאים לשימוש בשרת Node.js
 */

// שמירת ממצאים ועדכון context/history/state
function recordAdvisorSummary(conversation, advisorId, keyFindings = {}, nextStep = null) {
  if (!conversation || typeof conversation !== 'object') return;

  // עדכון context
  conversation.context = conversation.context || {};
  conversation.context.advisorFindings = conversation.context.advisorFindings || {};
  conversation.context.advisorFindings[advisorId] = {
    ...conversation.context.advisorFindings[advisorId],
    ...keyFindings
  };

  // הוספת הודעת מערכת להיסטוריה
  const summaryText = Object.entries(keyFindings)
    .map(([key, val]) => `- ${key}: ${val}`)
    .join('\n');

  const systemNote = {
    role: 'system',
    content: `✅ סיכום שיחה עם היועץ ${advisorId}:
${summaryText}` +
      (nextStep
        ? `\n➡️ הועבר ליועץ הבא: ${nextStep.advisorId} – ${nextStep.reason}`
        : '')
  };

  conversation.history = conversation.history || [];
  conversation.history.push(systemNote);

  // עדכון מצב handoff אם יש
  if (nextStep && nextStep.advisorId) {
    conversation.state = conversation.state || {};
    conversation.state.currentAdvisor = nextStep.advisorId;
  }
}

// עיבוד תוצאת יועץ מהמודל – קריאה לפונקציית הסיכום
function handleAdvisorResponse(result, conversation, advisorId) {
  if (!result || !conversation || !advisorId) return;

  const keyFindings = result.keyFindings || {};
  const nextStep = result.nextAdvisor || null;

  const hasFindings = Object.keys(keyFindings).length > 0;
  const hasHandoff = nextStep && nextStep.advisorId;

  if (hasFindings || hasHandoff) {
    recordAdvisorSummary(conversation, advisorId, keyFindings, nextStep);
  }
}

module.exports = {
  recordAdvisorSummary,
  handleAdvisorResponse
};
