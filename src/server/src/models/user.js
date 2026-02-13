// src/models/User.js - מודל משתמש
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // מידע אישי
  profile: {
    firstName: String,
    lastName: String,
    age: Number,
    familyStatus: String, // רווק, נשוי, גרוש, אלמן וכו'
    occupation: String,
    isIndependent: Boolean, // האם עצמאי
  },
  // מידע פיננסי
  financialProfile: {
    income: Number, // הכנסה חודשית
    expenses: Number, // הוצאות חודשיות
    savings: Number, // חסכונות
    investments: [
      {
        type: { type: String }, // סוג ההשקעה
        amount: Number, // סכום
        description: String // תיאור נוסף
      }
    ],
    loans: [
      {
        type: { type: String }, // סוג ההלוואה (משכנתא, הלוואת רכב וכו')
        amount: Number, // יתרה
        monthlyPayment: Number, // תשלום חודשי
        interestRate: Number, // ריבית
        endDate: Date // תאריך סיום
      }
    ],
    assets: [
      {
        type: { type: String }, // סוג הנכס
        value: Number, // שווי
        description: String // תיאור
      }
    ]
  },
  // מדד MFPL 2.0 - מוכנות פיננסית לפרישה מורחב
  mfplScore: {
    overall: { type: Number, default: 0 }, // ציון כולל
    components: {
      financialFoundations: { type: Number, default: 0 }, // יסודות פיננסיים
      behaviorAndHabits: { type: Number, default: 0 }, // התנהגות והרגלים
      pensionPlanning: { type: Number, default: 0 }, // תכנון פנסיוני
      assetDiversification: { type: Number, default: 0 }, // מגוון נכסים והשקעות
      alternativeInvestments: { type: Number, default: 0 }, // השקעות אלטרנטיביות
      mortgageOptimization: { type: Number, default: 0 }, // אופטימיזציית משכנתא
      legalAndInsurance: { type: Number, default: 0 }, // הכנה משפטית וביטוחית
      incomeGrowth: { type: Number, default: 0 }, // מקורות הכנסה וצמיחה
      specialSituationsResilience: { type: Number, default: 0 }, // עמידות למצבים מיוחדים
      dataBasedManagement: { type: Number, default: 0 }, // ניהול מבוסס נתונים
      resourceLifeQualityBalance: { type: Number, default: 0 }, // איזון משאבים-איכות חיים
      abundanceMindset: { type: Number, default: 0 }, // תודעת שפע
      intergenerationalTransfer: { type: Number, default: 0 }, // העברה בין-דורית
      retirementAlternatives: { type: Number, default: 0 }, // גמישות בפרישה
    }
  },
  // העדפות שיחה
  preferences: {
    advisorPreferences: [String], // יועצים מועדפים
    communicationStyle: {
      type: String,
      enum: ['detailed', 'concise', 'visual', 'simplified'],
      default: 'detailed'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);