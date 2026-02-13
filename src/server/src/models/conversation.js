// src/models/Conversation.js - מודל שיחה
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: "שיחה חדשה"
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  // מערכת דירוג הציון MFPL - לפני ואחרי השיחה
  mfplScores: {
    initial: {
      overall: { type: Number },
      components: {
        financialFoundations: { type: Number },
        behaviorAndHabits: { type: Number },
        pensionPlanning: { type: Number },
        assetDiversification: { type: Number },
        alternativeInvestments: { type: Number },
        mortgageOptimization: { type: Number },
        legalAndInsurance: { type: Number },
        incomeGrowth: { type: Number },
        specialSituationsResilience: { type: Number },
        dataBasedManagement: { type: Number },
        resourceLifeQualityBalance: { type: Number },
        abundanceMindset: { type: Number },
        intergenerationalTransfer: { type: Number },
        retirementAlternatives: { type: Number }
      }
    },
    current: {
      overall: { type: Number },
      components: {
        financialFoundations: { type: Number },
        behaviorAndHabits: { type: Number },
        pensionPlanning: { type: Number },
        assetDiversification: { type: Number },
        alternativeInvestments: { type: Number },
        mortgageOptimization: { type: Number },
        legalAndInsurance: { type: Number },
        incomeGrowth: { type: Number },
        specialSituationsResilience: { type: Number },
        dataBasedManagement: { type: Number },
        resourceLifeQualityBalance: { type: Number },
        abundanceMindset: { type: Number },
        intergenerationalTransfer: { type: Number },
        retirementAlternatives: { type: Number }
      }
    }
  },
  context: {
    userProfile: {
      age: Number,
      familyStatus: String,
      occupation: String,
      isIndependent: Boolean,
      hasChildren: Boolean
    },
    financialInfo: {
      income: Number,
      expenses: Number,
      savings: Number
    },
    goals: [{
      description: String,
      timeframe: String,
      priority: Number
    }],
    concerns: [{
      description: String,
      priority: Number
    }],
    triggers: {
      advisorTriggers: {
        budget: [String],
        mortgage: [String],
        investments: [String],
        retirement: [String],
        risk: [String],
        behavior: [String],
        selfemployed: [String],
        special: [String],
        data: [String],
        career: [String],
        meaning: [String],
        abundance: [String],
        young: [String],
        altinvest: [String],
        intergen: [String],
        altretire: [String]
      }
    }
  },
  recommendations: [{
    text: String,
    advisorId: String,
    category: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    timeframe: {
      type: String,
      enum: ['immediate', 'short-term', 'medium-term', 'long-term']
    },
    implemented: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  actionPlan: {
    created: {
      type: Boolean,
      default: false
    },
    steps: [{
      description: String,
      advisorId: String,
      deadline: Date,
      completed: {
        type: Boolean,
        default: false
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      }
    }]
  },
  state: {
    currentAdvisor: String,
    previousAdvisors: [String],
    pendingAdvisors: [String],
    conversationPhase: {
      type: String,
      enum: [
        'initial-mapping',
        'deep-analysis',
        'recommendations',
        'planning',
        'summary'
      ],
      default: 'initial-mapping'
    },
    firstName: String,
    userAge: String,

    // ✅ מבנה מלא של מפ"ל
    mapalScore: {
      financialFoundations: { type: Number, default: 0 },
      behaviorAndHabits: { type: Number, default: 0 },
      pensionPlanning: { type: Number, default: 0 },
      assetDiversification: { type: Number, default: 0 },
      alternativeInvestments: { type: Number, default: 0 },
      mortgageOptimization: { type: Number, default: 0 },
      legalAndInsurance: { type: Number, default: 0 },
      incomeGrowth: { type: Number, default: 0 },
      specialSituationsResilience: { type: Number, default: 0 },
      dataBasedManagement: { type: Number, default: 0 },
      resourceLifeQualityBalance: { type: Number, default: 0 },
      abundanceMindset: { type: Number, default: 0 },
      intergenerationalTransfer: { type: Number, default: 0 },
      retirementAlternatives: { type: Number, default: 0 },
      readiness: { type: Number, default: 0 },
      history: {
        type: [{
          timestamp: String,
          snapshot: { type: Object } // שמירת תמונת מצב מלאה
        }],
        default: []
      }
    },
    // סיכום מהיועץ הקודם להעברת context בין יועצים
    lastAdvisorSummary: {
      advisorId: String,
      advisorName: String,
      summary: String
    },
    // ✅ היסטוריית שינויים והסברים
    mapalHistory: {
      type: [{
        timestamp: String,
        domain: String,
        from: Number,
        to: Number,
        method: String,
        source: String,
        excerpt: String
      }],
      default: []
    }
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});


module.exports = mongoose.model('Conversation', conversationSchema);