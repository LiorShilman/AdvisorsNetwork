// config/config.js - קובץ קונפיגורציה מרכזי
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  // הגדרות סביבה
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 9292,
  
  // הגדרות בסיס נתונים
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/financial-advisors-360'
  },
  
  // הגדרות OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.MODEL_NAME || 'gpt-4o',
    temperature: parseFloat(process.env.TEMPERATURE || '0.6')
  },
  
  // הגדרות LangChain
  langchain: {
    verbose: process.env.NODE_ENV === 'development',
    memory: {
      maxTokenLimit: 10000
    }
  },
  
  // הגדרות מערכת היועצים
  advisorSystem: {
    defaultAdvisor: 'strategy',
    responseTimeout: 30000, // זמן תגובה מקסימלי במילישניות
    maxConversationLength: 100 // מספר מקסימלי של הודעות בשיחה
  },
  
  // הגדרות לוגים
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    // הגדרות נוספות ספציפיות ללוגים
    console: true,  // האם להציג לוגים בקונסול
    file: process.env.NODE_ENV === 'production',  // האם לשמור לוגים בקבצים
    logDir: 'logs'  // תיקיית הלוגים
  },
  
  // הגדרות אבטחה
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-default-jwt-secret-for-development',
    jwtExpiration: '24h',
    bcryptSaltRounds: 10
  },
  
  // הגדרות CORS
  cors: {
    //origin: process.env.CORS_ORIGIN || 'http://shilmanlior2608.ddns.net:4200',
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  // הגדרות שידור עדכונים בזמן אמת (אם צריך)
  realtime: {
    enabled: process.env.ENABLE_REALTIME === 'true' || false
  },
  
  // מבנה הודעת פתיחה ברירת מחדל
  defaultWelcomeMessage: `# 👨‍💼 אופק – מנהל יועצים פיננסיים

## ברוכים הבאים ל"אופק פיננסי 360°"

שלום! אני **אופק**, מנהל צוות היועצים הפיננסיים שלנו.

אשמח ללוות אותך בבניית תמונה פיננסית כוללת המותאמת לצרכים האישיים שלך. בעזרת צוות של 17 יועצים מומחים, נוכל לתכנן יחד את כל טווחי הזמן - מהתקציב החודשי השוטף, דרך החלטות קריירה ועד תכנון פרישה הוליסטי.

### לפני שנתחיל, אשמח להכיר אותך קצת:

1. **איך תרצה/י שאפנה אליך?** (שם)
2. **מה גילך כיום?**
3. **מה המצב המשפחתי שלך?** (רווק/ה, נשוי/אה, גרוש/ה, עם ילדים וכו')
4. **האם את/ה עובד/ת כשכיר/ה או עצמאי/ת?**

לאחר שנכיר, נוכל להתאים לך את הייעוץ הפיננסי הטוב ביותר, בהתאם לשלב החיים ולמטרות שלך. אני כאן כדי לכוון אותך ליועצים המתאימים בדיוק לצרכים שלך.`
};

module.exports = config;