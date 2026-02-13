// 📁 multiAgentComposer.js – מיזוג תגובות משני יועצים לתגובה אחת

const { ADVISOR_NAMES } = require('./../../configs/advisor-ids');

function composeMultiAdvisorResponse(advisorResponses, order = []) {
    if (!advisorResponses || typeof advisorResponses !== 'object') return '';
  
    const keys = order.length ? order : Object.keys(advisorResponses);
  
    const sections = keys.map(advisorId => {
      const text = advisorResponses[advisorId];
      if (!text) return '';
      const name = getDisplayName(advisorId);
      return `### 🧑‍💼 ${name}:
  ${text.trim()}`;
    }).filter(Boolean);
  
    return sections.join('\n\n---\n\n');
  }

  function composeAdvancedMultiAdvisorResponse(advisorResponses, order = []) {
  const composed = composeMultiAdvisorResponse(advisorResponses, order);

  return `
🧠 **שקלול משולב של מספר תחומים:**

${composed}

---

📌 אם תרצה להעמיק באחד התחומים – נוכל להתמקד ביועץ הרלוונטי ביותר.
  `;
}



  function getDisplayName(advisorId) {
    return ADVISOR_NAMES[advisorId] || advisorId;
  }
  
  function shouldUseMultiAdvisor(userMessage) {
    const lower = userMessage.toLowerCase();
  
    const keywordsPerAdvisor = {
      investments: ['השקעה', 'תשואה', 'תיק השקעות', 'בורסה'],
      mortgage: ['משכנתא', 'ריבית', 'הלוואה', 'דיור'],
      pension: ['פנסיה', 'פרישה', 'קצבה'],
      insurance: ['ביטוח', 'סיכון', 'כיסוי'],
      behavior: ['הרגלים', 'קניות', 'שליטה עצמית']
    };
  
    const matchedAdvisors = Object.entries(keywordsPerAdvisor)
      .filter(([advisorId, keywords]) => keywords.some(k => lower.includes(k)))
      .map(([advisorId]) => advisorId);
  
    const uniqueMatches = Array.from(new Set(matchedAdvisors));
    return uniqueMatches.length >= 2 ? uniqueMatches : null;
  }

  function saveAdvisorResponse(conversation, advisorId, text) {
    if (!conversation?.state) conversation.state = {};
    if (!conversation.state.advisorResponses) conversation.state.advisorResponses = {};
    conversation.state.advisorResponses[advisorId] = text?.trim?.() || '';
  }

  
  module.exports = {
    composeMultiAdvisorResponse,
    shouldUseMultiAdvisor,
    saveAdvisorResponse,
    composeAdvancedMultiAdvisorResponse
  };
  