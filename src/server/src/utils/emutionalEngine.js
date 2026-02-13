const  AdvisorEngine  = require('./advisorEngine');

function injectEmotionalQuestion(conversation, advisorId, parsedResponse) {
    if (!parsedResponse || !parsedResponse.text) return;
  
    const advisor = AdvisorEngine.getAdvisorById(advisorId);
    if (!advisor) return;
  
    // תמיכה עתידית בריבוי שאלות רגשיות
    const questions = Array.isArray(advisor.emotionalQuestions)
      ? advisor.emotionalQuestions
      : advisor.emotionalQuestion
      ? [advisor.emotionalQuestion]
      : [];
  
    if (!questions.length) return;
  
    // יצירת state אם לא קיים
    conversation.state.answeredEmotionalQuestions ||= [];
  
    // מציאת שאלה שעדיין לא נשאלה
    const questionToAsk = questions.find(q => !conversation.state.answeredEmotionalQuestions.includes(q));
  
    if (questionToAsk) {
      parsedResponse.text += `\n\n🧠 שאלה למחשבה:\n${questionToAsk}`;
      conversation.state.answeredEmotionalQuestions.push(questionToAsk);
    }
  }
  
  module.exports = {
    injectEmotionalQuestion
  };
  