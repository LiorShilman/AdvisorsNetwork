
const AdvisorEngine = require('./../utils/advisorEngine.js');
const ChatPromptBuilder = require('./chatPromptBuilder.js');
const { extractIdentitySmart } = require('../utils/extractAge');
const conversation = require('../models/conversation.js');
const TagUserMessageWithQuestionKey = require('./messageTagger'); // בלי { }
const ConversationStageManager = require('./conversationStageManager.js');
const { toLangchainMessages } = require('../utils/messageUtils');
const { JsonOutputFunctionsParser } = require("langchain/output_parsers");
const advisorNetworkSystem = require('../ai-orchestrator/advisorNetworkSystem');
class OrchestratorService {


  /**
   * מזהה את היועץ הרלוונטי ביותר לשאלה הבאה לפי תוכן ההודעה
   * @param {string} userInput - תוכן הודעת המשתמש
   * @param {Array<{ id: string, name: string }>} advisors - רשימת כל היועצים
   * @returns {object|null} - היועץ המתאים או null אם אין התאמה
   */
  detectRelevantAdvisor(userInput, advisors) {
    const lowerInput = userInput.toLowerCase();

    const keywordMap = [
      { advisorId: "mortgage", keywords: ["משכנתא", "ריבית", "החזר", "דירה", "נכס"] },
      { advisorId: "pension", keywords: ["פנסיה", "קצבה", "קרן פנסיה", "פרישה", "גמל", "היוון"] },
      { advisorId: "investments", keywords: ["השקעה", "מניה", "אג\"ח", "תשואה", "בורסה", "ניירות ערך", "מדדים"] },
      { advisorId: "risk", keywords: ["ביטוח", "בריאות", "חיים", "סיעוד", "כיסוי", "פוליסה", "אובדן כושר"] },
      { advisorId: "budget", keywords: ["תקציב", "הוצאות", "הכנסות", "מעקב", "איזון"] },
      { advisorId: "strategy", keywords: ["מטרה", "אסטרטגיה", "חזון", "כיוון", "תוכנית כוללת"] },
      { advisorId: "career", keywords: ["קריירה", "שכר", "עבודה", "מקצוע", "משכורת", "תפקיד"] },
      { advisorId: "behavior", keywords: ["רגש", "אמונה", "לחץ", "חרדה", "מחשבות", "עומס רגשי"] },
      { advisorId: "special", keywords: ["משפחה", "ילדים", "זוגיות", "הורה", "חינוך", "מורחבת"] },
      { advisorId: "selfemployed", keywords: ["עסק", "עצמאי", "הכנסה משתנה", "עוסק מורשה", "חברה", "פרילנסר"] },
      { advisorId: "data", keywords: ["נתונים", "סטטיסטיקה", "מעקב", "גרפים", "דוח", "אפליקציה", "כלים"] },
      { advisorId: "meaning", keywords: ["ערכים", "משמעות", "שפע", "סיפוק", "הגדרה להצלחה", "פנאי", "אושר"] },
      { advisorId: "young", keywords: ["צעיר", "נוער", "סטודנט", "קריפטו", "דיגיטלי", "לימודים", "קניית דירה"] },
      { advisorId: "altinvest", keywords: ["נדלן", "אלטרנטיבי", "קרנות גידור", "השקעות אימפקט", "מטבעות"] },
      { advisorId: "intergen", keywords: ["ירושה", "דורות", "העברה בין דורית", "צוואה", "מוטבים", "נאמנות"] },
      { advisorId: "altretire", keywords: ["פרישה הדרגתית", "קריירה שניה", "המשך עבודה", "נוודות", "איזון"] },
      { advisorId: "futureself", keywords: ["עצמי עתידי", "אם לא תפעל", "עוד 10 שנים"] },
      { advisorId: "strategy", keywords: ["כללי", "לא יודע", "עזרה", "התחלה", "תיאום", "שילוב"] }
    ];

    for (const { advisorId, keywords } of keywordMap) {
      if (keywords.some(word => lowerInput.includes(word))) {
        return advisors.find(a => a.id === advisorId) || null;
      }
    }

    return null;
  }

  
}

module.exports = new OrchestratorService();




