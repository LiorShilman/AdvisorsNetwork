// 📁 resolveAdvisorTensions.js – זיהוי סתירות בין יועצים

const CONFLICT_RULES = [
    {
      advisors: ['mortgage', 'investments'],
      condition: (messages) =>
        messages.mortgage?.includes('הלוואה ל-30 שנה') &&
        (messages.investments?.includes('תזרים מהיר') || messages.investments?.includes('טווח קצר')),
      summary: 'המשכנתא ממליצה על פריסה ל-30 שנה, בעוד שהשקעות מדגישים תזרים מהיר או השקעות קצרות טווח.'
    },
    {
      advisors: ['insurance', 'behavior'],
      condition: (messages) =>
        messages.insurance?.includes('כיסוי מקיף') &&
        messages.behavior?.includes('קיצוץ הוצאות קבועות'),
      summary: 'היועץ הביטוחי מציע הרחבת כיסוי, בעוד שיועץ ההתנהגות ממליץ לצמצם התחייבויות קבועות.'
    }
  ];
  
  async function detectAdvisorTensionWithModel(conversation, model) {
  const responses = conversation.state?.advisorResponses;
  if (!responses) return { tensionDetected: false };

  const joinedResponses = Object.entries(responses).map(([id, text]) => {
    const name = getDisplayName(id);
    return `יועץ: ${name}\nתשובה:\n${text}`;
  }).join('\n\n---\n\n');

  const prompt = `
קרא את התשובות של מספר יועצים פיננסיים. בדוק אם יש ביניהם סתירה או גישות מנוגדות.

אם יש סתירה – סכם אותה במשפט ברור וכתוב בין אילו יועצים היא התגלתה. אם אין, כתוב רק "אין סתירה".

${joinedResponses}
`;

  const res = await model.invoke([new SystemMessage(prompt)]);
  const content = res.content.trim();

  if (content.toLowerCase().includes('אין סתירה')) {
    return { tensionDetected: false };
  }

  return {
    tensionDetected: true,
    summary: content,
    conflictingAdvisors: extractAdvisorIdsFromText(content)
  };
}

  function detectAdvisorTension(conversation) {
    if (!conversation?.state?.advisorResponses) return null;
  
    const messages = conversation.state.advisorResponses; // מבנה: { mortgage: 'טקסט', investments: 'טקסט' }
  
    for (const rule of CONFLICT_RULES) {
      if (rule.condition(messages)) {
        return {
          tensionDetected: true,
          conflictingAdvisors: rule.advisors,
          summary: rule.summary
        };
      }
    }
  
    return { tensionDetected: false };
  }
  
  function renderTensionMarkdown(tensionResult) {
    if (!tensionResult?.tensionDetected) return '';
  
    const [a1, a2] = tensionResult.conflictingAdvisors;
    return `⚠️ **הבחנתי בסתירה בין המלצות היועצים:**\n\n` +
      `• ${a1} מול ${a2}  
  ` +
      `**${tensionResult.summary}**\n\n` +
      `_רוצה לשמוע איך אפשר לאזן בין שתי הגישות?_`;
  }
  
  module.exports = {
    detectAdvisorTension,
    renderTensionMarkdown,
    detectAdvisorTensionWithModel
  };
  