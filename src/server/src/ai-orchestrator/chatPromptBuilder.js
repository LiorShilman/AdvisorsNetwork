// chatPromptBuilder.js
const ConversationStageManager = require('./conversationStageManager.js');

const {injectAdvisorMemory} = require('./../utils/advisorMemoryManager');
const {renderDecisionStyleMarkdown} = require('./../utils/decisionStyleDetector');
const {getMapalGuidanceText} = require('./../utils/mapalPromptUtils');
const { extractTextFromMessage } = require('./../utils/messageUtils');

class ChatPromptBuilder {

  /**
   * Initializes a new session with the advisor's opening system message only
   * @param {object} advisor - The advisor to start with
   * @returns {Array<{ role: string, content: string }> & { conversationStage: string }}
   */
  initSession(advisor) {
  const exampleTopics = `
📌 הנה כמה נושאים שיכולים לעניין משתמשים בשלב ההתחלה:
- 📉 להרגיש יותר בשליטה על ההוצאות
- 💰 להתחיל לחסוך או להשקיע נכון
- 🧒 תכנון לעתיד הילדים
- 🧓 להבין מה מצב הפנסיה

אם משהו מזה נשמע לך רלוונטי – אפשר להתחיל משם.
ואם לא, אפשר גם פשוט לספר מה חשוב לך כרגע.`;

  const dynamicIntro = `👋 **היי! אני ${advisor.name}**, היועץ האישי שלך כאן ב־*אופק פיננסי 360°*.

לפני שנתחיל, אשמח לדעת:
- **איך לקרוא לך?** (שם פרטי יספיק)
- **ומה גילך?**

${exampleTopics}`;

  const fullSystemPrompt = `${advisor.systemPrompt}

🧠 הנה שאלות מפתח שאוכל להשתמש בהן בשיחה, לפי הצורך:
${advisor.keyQuestions?.map((q, i) => `• ${q.question}`).join('\n')}

❗️ אל תשאל את כל השאלות ברצף.
נהל שיחה נעימה, בקצב מתאים למשתמש, בגובה העיניים.
בחר שאלה אחת או שתיים בכל פעם, לפי ההקשר.`;

  const systemMessages = [{ role: 'system', content: fullSystemPrompt }];

  return {
    systemMessages,
    userIntroMessage: dynamicIntro,
    stage: 'intro'
  };
}

  /**
   * Builds the full message array to send to OpenAI chat API
   * @param {object} advisor - The advisor object (with systemPrompt, keyQuestions, etc)
   * @param {Array<{ role: 'user' | 'assistant', content: string }>} history - Prior messages in this session
   * @param {string} userMessage - The new message from the user
   * @param {boolean} isFirstMessage - Indicates if it's the start of the session
   * @returns {Array<{ role: string, content: string }> & { conversationStage: string }}
   */
  /**
   * גרסה חכמה של buildChatMessages עם ניהול שלבים ודילוג על שאלות שנענו
   */
  buildChatMessages(advisor, history, conversation, userMessage = null) {
    const messages = [];
  
    // 🧠 הזרקת זיכרון מהיועץ הקודם
    injectAdvisorMemory(advisor, conversation);
  
    // 📊 טקסט הדרכה מותאם למדד מפ״ל לפי תחום היועץ
    const mapalText = getMapalGuidanceText(advisor.advisorId);
  
    const fullSystemPrompt = `${advisor.systemPrompt}
  
  🧭 מדד מפ"ל:
  לאורך השיחה תחשב מערכת פנימית ציון של מדד מפ״ל – מדד פוטנציאל לצמיחה וליווי.  
  הוא נועד לעזור להבין את רמת המוכנות הפיננסית של המשתמש, בהתבסס על:
  - בהירות מטרותיו
  - מודעותו למצבו הפיננסי
  - הרצון והיכולת לפעול לשינוי
  
  **אין צורך לציין את המדד ישירות בשיחה**, אך ניתן לרמוז על התקדמות, מוכנות או קפיצה תודעתית אם אתה מרגיש שהמשתמש בשל לכך.
  
  ---
  
  📋 הנה רשימת שאלות עיקריות לזיהוי מצבו של המשתמש:
  ${advisor.keyQuestions?.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}
  
  ---
  
  📌 הנחיות לניהול השיחה:
  - אל תשאל את כל השאלות ברצף.
  - נהל שיחה חכמה, מותאמת ודיאלוגית.
  - שאל רק שאלה אחת בכל פעם.
  - סמן כל שאלה שנענתה לפי questionKey כדי להימנע מחזרה.
  
  ${mapalText}
  
  📌 הנחיה סגנונית:
  אם כבר פנית למשתמש בעבר – **אין צורך לחזור על פתיחים כלליים** כמו "שמח להכיר אותך", "נעים להכיר" וכדומה.  
  אפשר להשתמש בשם הפרטי בלבד לפנייה טבעית וחמה (למשל: "יואב, שים לב ש...").
  `;
  
    messages.push({ role: 'system', content: fullSystemPrompt });
  
    if (Array.isArray(history)) {
      messages.push(...history);
    }
  
    const stage = ConversationStageManager.detectConversationStage(messages, advisor);
  
    const answeredKeys = messages
      .filter(m => m.role === 'user' && m.questionKey)
      .map(m => m.questionKey);

    if (!Array.isArray(advisor.keyQuestions)) {
        console.warn(`⚠️ advisor ${advisor.advisorId} is missing keyQuestions`);
        advisor.keyQuestions = []; // או טען ברירת מחדל
    }

  
    const nextQuestion = advisor.keyQuestions.find(q => !answeredKeys.includes(q.key));
  
    if (stage === 'active' && nextQuestion) {
      messages.push({
        role: 'assistant',
        content: `תודה! שאלה נוספת כדי להבין אותך טוב יותר: ${nextQuestion.question}`,
        questionKey: nextQuestion.key
      });
    }
  
    if (stage === 'ready_for_summary') {
      messages.push({
        role: 'assistant',
        content: `בהתבסס על מה שסיפרת לי עד כה – הנה הסיכום או ההמלצה שלי:`
      });
    }
  
    if (stage === 'need_clarification') {
      messages.push({
        role: 'assistant',
        content: `נראה שדרושה הבהרה – אשמח להסביר זאת אחרת או לשאול שוב בצורה ברורה יותר.`
      });
    }
  
    if (advisor.id === 'futureself' && conversation.state?.decisionStyle) {
      const decisionReflection = renderDecisionStyleMarkdown(conversation.state.decisionStyle);
      if (decisionReflection) {
        advisor.systemPrompt += `\n\n---\n🧠 שיקוף על סגנון קבלת ההחלטות שלך:\n${decisionReflection}`;
      }
    }
  
    return {
      messages,
      stage
    };
  }
  
  

  /**
   * Routes conversation flow based on detected stage
   * @param {string} stage - The conversation stage
   * @param {object} advisor - Advisor object
   * @returns {string} - Suggested strategy or message
   */
  routeByConversationStage(stage, advisor) {
    switch (stage) {
      case 'intro':
        return `בוא נתחיל! ${advisor.name} ישאל אותך שאלה כדי להבין את מצבך.`;
      case 'need_clarification':
        return 'נראה שדרושה הבהרה – אשמח לחדד או לשאול בצורה אחרת.';
      case 'ready_for_summary':
        return 'מעולה! נראה שאתה מוכן לקבל סיכום או המלצה מעשית.';
      case 'active':
      default:
        return 'נמשיך בשיחה לפי מה שכתבת. האם תרצה להתמקד בתחום מסוים?';
    }
  }
}

module.exports = new ChatPromptBuilder();