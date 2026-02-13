// 📁 advisorMemoryManager.js – יצירת הקשר בין-יועצי זוכר

function extractAdvisorMemory(conversation, advisorId) {
    // דוגמה בסיסית: נשען על lastAdvisorSummary בלבד
    if (!conversation?.state?.lastAdvisorSummary) return null;
  
    const { advisorName, advisorId: prevId, summaryText } = conversation.state.lastAdvisorSummary;
    return {
      advisorId: prevId,
      advisorName,
      memoryText: summaryText || ''
    };
  }
  
  function buildAdvisorMemoryPrompt(memory) {
    if (!memory || !memory.memoryText) return '';
  
    return `\n\n---\n🔁 מידע חשוב מהיועץ הקודם (${memory.advisorName}):\n${memory.memoryText}`;
  }
  
  // שילוב לתוך ה־systemPrompt
  function injectAdvisorMemory(advisor, conversation) {
    const memory = extractAdvisorMemory(conversation, advisor.id);
    const memoryPrompt = buildAdvisorMemoryPrompt(memory);
    advisor.systemPrompt += memoryPrompt;
  }
  
  module.exports = {
    injectAdvisorMemory,
    extractAdvisorMemory,
    buildAdvisorMemoryPrompt
  };
  