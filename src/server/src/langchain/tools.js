// src/langchain/tools.js - הגדרת כלים עבור היועצים
const { StructuredTool } = require('langchain/tools');
const { z } = require('zod');
const { ChatOpenAI } = require('@langchain/openai');

const { AgentExecutor, createToolUseAgent } = require('langchain/agents'); 
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const config = require('../../configs/config');
const logger = require('../utils/logger');

/**
 * יצירת מחשבון פיננסי - משמש לביצוע חישובים פיננסיים מורכבים
 */
const financialCalculatorTool = new StructuredTool({
  name: 'financial_calculator',
  description: 'מחשבון פיננסי לביצוע חישובים כלכליים מורכבים',
  schema: z.object({
    calculation: z.string().describe('נוסחת החישוב, למשל חישוב ריבית דריבית, החזר משכנתא, וכד\''),
  }),
  async func({ calculation }) {
    try {
      // שימוש בפונקציית החישוב של LangChain
      const calculatorTool = createCalculatorTool();
      return await calculatorTool.invoke(calculation);
    } catch (error) {
      logger.error('Error in financial calculator tool:', error);
      return `Error calculating: ${error.message}`;
    }
  },
});

/**
 * כלי לחישוב ערך עתידי של חיסכון
 */
const futureValueTool = new StructuredTool({
  name: 'future_value_calculator',
  description: 'חישוב ערך עתידי של חיסכון או השקעה',
  schema: z.object({
    principal: z.number().describe('סכום הקרן ההתחלתי'),
    monthlyDeposit: z.number().describe('הפקדה חודשית'),
    annualInterestRate: z.number().describe('ריבית שנתית באחוזים'),
    years: z.number().describe('מספר שנים'),
    compoundingFrequency: z.enum(['monthly', 'quarterly', 'semi-annually', 'annually']).default('monthly').describe('תדירות חישוב הריבית'),
  }),
  async func({ principal, monthlyDeposit, annualInterestRate, years, compoundingFrequency }) {
    try {
      let periodsPerYear;
      switch (compoundingFrequency) {
        case 'monthly': 
          periodsPerYear = 12; 
          break;
        case 'quarterly': 
          periodsPerYear = 4; 
          break;
        case 'semi-annually': 
          periodsPerYear = 2; 
          break;
        case 'annually': 
          periodsPerYear = 1; 
          break;
        default: 
          periodsPerYear = 12;
      }
      
      // חישוב הריבית לתקופה
      const ratePerPeriod = annualInterestRate / 100 / periodsPerYear;
      const totalPeriods = years * periodsPerYear;
      
      // חישוב ערך עתידי של הקרן עם ריבית דריבית
      const futureValuePrincipal = principal * Math.pow(1 + ratePerPeriod, totalPeriods);
      
      // חישוב ערך עתידי של ההפקדות החודשיות
      let futureValueDeposits = 0;
      if (ratePerPeriod > 0) {
        // אם הריבית היא חודשית והתדירות שונה, נתאים את ההפקדה החודשית לתקופה
        const depositPerPeriod = monthlyDeposit * (12 / periodsPerYear);
        futureValueDeposits = depositPerPeriod * ((Math.pow(1 + ratePerPeriod, totalPeriods) - 1) / ratePerPeriod);
      } else {
        // אם אין ריבית, זה פשוט סכום ההפקדות
        futureValueDeposits = monthlyDeposit * 12 * years;
      }
      
      // סכום הערך העתידי
      const totalFutureValue = futureValuePrincipal + futureValueDeposits;
      
      // סך ההפקדות
      const totalDeposits = principal + (monthlyDeposit * 12 * years);
      
      // הרווחים מריבית
      const interestEarned = totalFutureValue - totalDeposits;
      
      return {
        totalFutureValue: Math.round(totalFutureValue),
        futureValuePrincipal: Math.round(futureValuePrincipal),
        futureValueDeposits: Math.round(futureValueDeposits),
        totalDeposits: Math.round(totalDeposits),
        interestEarned: Math.round(interestEarned),
        years: years,
        message: `לאחר ${years} שנים, עם הפקדה חודשית של ${monthlyDeposit} ש"ח וריבית שנתית של ${annualInterestRate}%, הערך העתידי הצפוי הוא ${Math.round(totalFutureValue).toLocaleString()} ש"ח. סך ההפקדות: ${Math.round(totalDeposits).toLocaleString()} ש"ח, רווחים: ${Math.round(interestEarned).toLocaleString()} ש"ח.`
      };
    } catch (error) {
      logger.error('Error in future value calculator:', error);
      return `Error calculating future value: ${error.message}`;
    }
  },
});

/**
 * כלי לחישוב החזר משכנתא
 */
const mortgageCalculatorTool = new StructuredTool({
  name: 'mortgage_calculator',
  description: 'חישוב תשלום חודשי והחזר כולל עבור משכנתא',
  schema: z.object({
    loanAmount: z.number().describe('סכום ההלוואה'),
    annualInterestRate: z.number().describe('ריבית שנתית באחוזים'),
    loanTermYears: z.number().describe('תקופת ההלוואה בשנים'),
    downPayment: z.number().optional().describe('הון עצמי (אופציונלי)'),
  }),
  async func({ loanAmount, annualInterestRate, loanTermYears, downPayment = 0 }) {
    try {
      // חישוב סכום ההלוואה בניכוי הון עצמי
      const principal = loanAmount - downPayment;
      
      // חישוב ריבית חודשית
      const monthlyRate = annualInterestRate / 100 / 12;
      
      // חישוב מספר תשלומים
      const numberOfPayments = loanTermYears * 12;
      
      // חישוב תשלום חודשי
      const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
      
      // חישוב סך ההחזר
      const totalPayment = monthlyPayment * numberOfPayments;
      
      // חישוב סך הריבית
      const totalInterest = totalPayment - principal;
      
      // חישוב יחס החזר-הכנסה (נניח הכנסה חודשית ממוצעת של 15,000 ש"ח)
      const assumedMonthlyIncome = 15000;
      const paymentToIncomeRatio = (monthlyPayment / assumedMonthlyIncome) * 100;
      
      return {
        monthlyPayment: Math.round(monthlyPayment),
        totalPayment: Math.round(totalPayment),
        totalInterest: Math.round(totalInterest),
        paymentToIncomeRatio: paymentToIncomeRatio.toFixed(2),
        message: `התשלום החודשי עבור משכנתא בסך ${principal.toLocaleString()} ש"ח, לתקופה של ${loanTermYears} שנים, בריבית ${annualInterestRate}% הוא ${Math.round(monthlyPayment).toLocaleString()} ש"ח. סך ההחזר הכולל: ${Math.round(totalPayment).toLocaleString()} ש"ח, מתוכו ריבית: ${Math.round(totalInterest).toLocaleString()} ש"ח.`
      };
    } catch (error) {
      logger.error('Error in mortgage calculator:', error);
      return `Error calculating mortgage: ${error.message}`;
    }
  },
});

/**
 * כלי לחישוב ציון מפ"ל 2.0
 */
const mfplCalculatorTool = new StructuredTool({
  name: 'mfpl_calculator',
  description: 'חישוב ציון מפ"ל 2.0 (מוכנות פיננסית לפרישה מורחב)',
  schema: z.object({
    financialFoundations: z.number().min(0).max(10).optional().describe('יסודות פיננסיים'),
    behaviorAndHabits: z.number().min(0).max(10).optional().describe('התנהגות והרגלים'),
    pensionPlanning: z.number().min(0).max(10).optional().describe('תכנון פנסיוני'),
    assetDiversification: z.number().min(0).max(10).optional().describe('מגוון נכסים והשקעות'),
    alternativeInvestments: z.number().min(0).max(10).optional().describe('השקעות אלטרנטיביות'),
    mortgageOptimization: z.number().min(0).max(10).optional().describe('אופטימיזציית משכנתא'),
    legalAndInsurance: z.number().min(0).max(10).optional().describe('הכנה משפטית וביטוחית'),
    incomeGrowth: z.number().min(0).max(10).optional().describe('מקורות הכנסה וצמיחה'),
    specialSituationsResilience: z.number().min(0).max(10).optional().describe('עמידות למצבים מיוחדים'),
    dataBasedManagement: z.number().min(0).max(10).optional().describe('ניהול מבוסס נתונים'),
    resourceLifeQualityBalance: z.number().min(0).max(10).optional().describe('איזון משאבים-איכות חיים'),
    abundanceMindset: z.number().min(0).max(10).optional().describe('תודעת שפע'),
    intergenerationalTransfer: z.number().min(0).max(10).optional().describe('העברה בין-דורית'),
    retirementAlternatives: z.number().min(0).max(10).optional().describe('גמישות בפרישה'),
  }),
  async func(scores) {
    try {
      // משקולות של כל רכיב במדד
      const weights = {
        financialFoundations: 0.10,
        behaviorAndHabits: 0.06,
        pensionPlanning: 0.12,
        assetDiversification: 0.12,
        alternativeInvestments: 0.05,
        mortgageOptimization: 0.08,
        legalAndInsurance: 0.07,
        incomeGrowth: 0.07,
        specialSituationsResilience: 0.08,
        dataBasedManagement: 0.05,
        resourceLifeQualityBalance: 0.06,
        abundanceMindset: 0.06,
        intergenerationalTransfer: 0.04,
        retirementAlternatives: 0.04
      };
      
      // ערכי ברירת מחדל לרכיבים חסרים
      const defaultScores = {
        financialFoundations: 0,
        behaviorAndHabits: 0,
        pensionPlanning: 0,
        assetDiversification: 0,
        alternativeInvestments: 0,
        mortgageOptimization: 0,
        legalAndInsurance: 0,
        incomeGrowth: 0,
        specialSituationsResilience: 0,
        dataBasedManagement: 0,
        resourceLifeQualityBalance: 0,
        abundanceMindset: 0,
        intergenerationalTransfer: 0,
        retirementAlternatives: 0
      };
      
      // שילוב ערכי ברירת המחדל עם הערכים שהתקבלו
      const combinedScores = { ...defaultScores, ...scores };
      
      // חישוב הציון המשוקלל
      let weightedSum = 0;
      let totalWeight = 0;
      
      for (const [component, score] of Object.entries(combinedScores)) {
        if (weights[component] && score !== undefined) {
          weightedSum += score * weights[component];
          totalWeight += weights[component];
        }
      }
      
      // אם לא התקבלו מרכיבים מוגדרים, מחזירים ציון 0
      if (totalWeight === 0) {
        return {
          overall: 0,
          components: combinedScores,
          message: "לא התקבלו נתונים מספיקים לחישוב ציון מפ\"ל 2.0"
        };
      }
      
      // נרמול הציון המשוקלל לפי המשקל הכולל של הרכיבים שחושבו
      const overallScore = (weightedSum / totalWeight) * 10;
      
      // בניית תיאור מילולי של הציון
      let scoreDescription = "";
      if (overallScore < 3) {
        scoreDescription = "נמוך מאוד - דרוש שיפור מיידי";
      } else if (overallScore < 5) {
        scoreDescription = "נמוך - דרוש שיפור משמעותי";
      } else if (overallScore < 7) {
        scoreDescription = "בינוני - יש מקום לשיפור";
      } else if (overallScore < 8.5) {
        scoreDescription = "טוב - מצב פיננסי יציב";
      } else {
        scoreDescription = "מצוין - מוכנות פיננסית גבוהה";
      }
      
      return {
        overall: parseFloat(overallScore.toFixed(1)),
        components: combinedScores,
        description: scoreDescription,
        message: `ציון מפ"ל 2.0 הכולל: ${overallScore.toFixed(1)}/10 (${scoreDescription})`
      };
    } catch (error) {
      logger.error('Error in MFPL calculator:', error);
      return `Error calculating MFPL score: ${error.message}`;
    }
  },
});

/**
 * כלי לסימולציית תרחישי משבר
 */
const crisisSimulatorTool = new StructuredTool({
  name: 'crisis_simulator',
  description: 'סימולציה של תרחישי משבר או אירועים בלתי צפויים והשפעתם על המצב הפיננסי',
  schema: z.object({
    scenario: z.enum([
      'job_loss', 
      'medical_emergency', 
      'market_crash', 
      'housing_crisis',
      'inflation_spike', 
      'disability',
      'business_failure',
      'divorce',
      'combined'
    ]).describe('סוג התרחיש לבדיקה'),
    monthlySavings: z.number().describe('סכום חיסכון חודשי בש"ח'),
    emergencyFund: z.number().describe('גודל קרן חירום בש"ח'),
    monthlyExpenses: z.number().describe('הוצאות חודשיות בש"ח'),
    liquidAssets: z.number().describe('נכסים נזילים בש"ח'),
    hasInsurance: z.boolean().describe('האם קיים כיסוי ביטוחי רלוונטי'),
    scenarioDuration: z.number().optional().describe('משך התרחיש בחודשים (ברירת מחדל: 6)'),
  }),
  async func({ scenario, monthlySavings, emergencyFund, monthlyExpenses, liquidAssets, hasInsurance, scenarioDuration = 6 }) {
    try {
      // זמן התאוששות ועלות ממוצעת לפי תרחיש (בחודשים ובש"ח)
      const scenarioParams = {
        job_loss: { 
          recoveryTime: 6, 
          averageCost: monthlyExpenses * 6, 
          impactDescription: "אובדן מקור הכנסה לתקופה משמעותית" 
        },
        medical_emergency: { 
          recoveryTime: 3, 
          averageCost: hasInsurance ? 20000 : 80000, 
          impactDescription: "הוצאות רפואיות משמעותיות והיעדרות זמנית מעבודה" 
        },
        market_crash: { 
          recoveryTime: 24, 
          averageCost: liquidAssets * 0.3, 
          impactDescription: "ירידה משמעותית בערך תיק ההשקעות" 
        },
        housing_crisis: { 
          recoveryTime: 12, 
          averageCost: monthlyExpenses * 3, 
          impactDescription: "עלייה בהוצאות דיור או ירידה בערך נכסי נדל\"ן" 
        },
        inflation_spike: { 
          recoveryTime: 18, 
          averageCost: monthlyExpenses * 0.2 * 18, 
          impactDescription: "עלייה משמעותית ביוקר המחיה לאורך זמן" 
        },
        disability: { 
          recoveryTime: 12, 
          averageCost: hasInsurance ? monthlyExpenses * 3 : monthlyExpenses * 12, 
          impactDescription: "אובדן כושר עבודה זמני" 
        },
        business_failure: { 
          recoveryTime: 12, 
          averageCost: monthlyExpenses * 12, 
          impactDescription: "סגירת עסק והפסד השקעה" 
        },
        divorce: { 
          recoveryTime: 24, 
          averageCost: liquidAssets * 0.5 + 50000, 
          impactDescription: "חלוקת נכסים והוצאות משפטיות" 
        },
        combined: { 
          recoveryTime: 24, 
          averageCost: monthlyExpenses * 12 + liquidAssets * 0.3, 
          impactDescription: "שילוב של מספר משברים במקביל" 
        }
      };
      
      // התאמת משך התרחיש אם צוין
      const actualDuration = scenarioDuration || scenarioParams[scenario].recoveryTime;
      
      // חישוב עלות התרחיש בפועל
      const actualCost = scenarioParams[scenario].averageCost * (actualDuration / scenarioParams[scenario].recoveryTime);
      
      // חישוב משאבים זמינים
      const availableResources = emergencyFund + liquidAssets + (monthlySavings * actualDuration);
      
      // חישוב יחס כיסוי - כמה חודשים ניתן לשרוד
      const survivalRatio = availableResources / monthlyExpenses;
      
      // חישוב פער
      const gap = availableResources - actualCost;
      
      // קביעת רמת העמידות
      let resilienceLevel = "";
      let recommendations = [];
      
      if (gap >= 0 && survivalRatio >= actualDuration * 1.5) {
        resilienceLevel = "גבוהה";
        recommendations = [
          "המשך בניית קרן חירום ליעד של 6-9 חודשי הוצאות",
          "שקול הגדלת כיסויים ביטוחיים",
          "גוון את תיק ההשקעות להפחתת תלות בשוק ספציפי"
        ];
      } else if (gap >= 0) {
        resilienceLevel = "בינונית";
        recommendations = [
          "הגדל את קרן החירום ליעד של לפחות 6 חודשי הוצאות",
          "בדוק והרחב כיסויים ביטוחיים",
          "בנה תכנית מגירה להפחתת הוצאות במצב חירום",
          "פתח מקורות הכנסה נוספים"
        ];
      } else if (gap >= -monthlyExpenses * 3) {
        resilienceLevel = "נמוכה";
        recommendations = [
          "תעדף בניית קרן חירום מיידית",
          "הוסף או שפר כיסויים ביטוחיים חיוניים",
          "הכן תכנית להפחתת הוצאות משמעותית למקרה חירום",
          "חזק רשתות תמיכה משפחתיות/חברתיות",
          "שקול מקורות הכנסה נוספים"
        ];
    } else {
        resilienceLevel = "קריטית";
        recommendations = [
          "בנה קרן חירום באופן מיידי - אפילו סכומים קטנים",
          "מצא דרכים לצמצם הוצאות משמעותית",
          "רכוש ביטוחים חיוניים - בריאות, אובדן כושר עבודה",
          "חפש מקורות הכנסה נוספים",
          "בחן אפשרויות לרשת ביטחון משפחתית במקרה חירום"
        ];
      }
      
      return {
        scenario: scenario,
        scenarioDescription: scenarioParams[scenario].impactDescription,
        duration: actualDuration,
        estimatedCost: Math.round(actualCost),
        availableResources: Math.round(availableResources),
        survivalMonths: Math.round(survivalRatio * 10) / 10,
        gap: Math.round(gap),
        resilienceLevel: resilienceLevel,
        recommendations: recommendations,
        message: `בתרחיש של ${scenarioParams[scenario].impactDescription} למשך ${actualDuration} חודשים, העלות המוערכת היא ${Math.round(actualCost).toLocaleString()} ₪. עם המשאבים הקיימים של ${Math.round(availableResources).toLocaleString()} ₪, רמת העמידות שלך ${resilienceLevel}${gap >= 0 ? '. יש לך מספיק משאבים להתמודד עם התרחיש' : '. הפער הכספי הצפוי: ' + Math.abs(Math.round(gap)).toLocaleString() + ' ₪'}.`
      };
    } catch (error) {
      logger.error('Error in crisis simulator:', error);
      return `Error in crisis simulation: ${error.message}`;
    }
  },
});

/**
 * כלי לניתוח תקציב
 */
const budgetAnalyzerTool = new StructuredTool({
  name: 'budget_analyzer',
  description: 'ניתוח תקציב והוצאות וזיהוי הזדמנויות לחיסכון',
  schema: z.object({
    monthlyIncome: z.number().describe('הכנסה חודשית נטו בש"ח'),
    expenses: z.record(z.number()).describe('פירוט הוצאות לפי קטגוריות (מפתח: קטגוריה, ערך: סכום)'),
    savingsGoal: z.number().optional().describe('יעד חיסכון חודשי רצוי בש"ח'),
  }),
  async func({ monthlyIncome, expenses, savingsGoal }) {
    try {
      // חישוב סך ההוצאות
      const totalExpenses = Object.values(expenses).reduce((sum, expense) => sum + expense, 0);
      
      // חישוב יתרה פנויה
      const disposableIncome = monthlyIncome - totalExpenses;
      
      // חישוב יחס חיסכון נוכחי
      const currentSavingsRatio = (disposableIncome / monthlyIncome) * 100;
      
      // יחס חיסכון מטרה (אם לא צוין, נניח 20%)
      const targetSavingsRatio = savingsGoal ? (savingsGoal / monthlyIncome) * 100 : 20;
      
      // בדיקה אם היעד אפשרי
      const isGoalFeasible = disposableIncome >= (savingsGoal || 0);
      
      // מיון הוצאות בסדר יורד לפי גודל
      const sortedExpenses = Object.entries(expenses)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({
          category,
          amount,
          percentOfIncome: (amount / monthlyIncome) * 100
        }));
      
      // בניית המלצות
      const recommendations = [];
      
      // המלצות בסיסיות לפי מצב התקציב
      if (disposableIncome < 0) {
        recommendations.push({
          priority: "critical",
          description: "התקציב שלך גירעוני - יש לצמצם הוצאות באופן מיידי",
          potentialSavings: Math.abs(disposableIncome)
        });
      } else if (currentSavingsRatio < targetSavingsRatio) {
        recommendations.push({
          priority: "high",
          description: `הגדל את שיעור החיסכון מ-${currentSavingsRatio.toFixed(1)}% ל-${targetSavingsRatio.toFixed(1)}%`,
          potentialSavings: (targetSavingsRatio - currentSavingsRatio) * monthlyIncome / 100
        });
      }
      
      // המלצות לחיסכון בקטגוריות עם הוצאה גבוהה
      const expensiveCategoriesThreshold = 0.15; // 15% מההכנסה
      
      sortedExpenses.forEach(item => {
        if (item.percentOfIncome > expensiveCategoriesThreshold) {
          // אם הקטגוריה היא מעל הסף, הצע צמצום של 10-20%
          const savingRate = item.percentOfIncome > 25 ? 0.2 : 0.1; // 20% או 10% חיסכון
          recommendations.push({
            priority: item.percentOfIncome > 25 ? "high" : "medium",
            description: `צמצום הוצאות ב-${item.category} ב-${(savingRate * 100).toFixed(0)}%`,
            potentialSavings: item.amount * savingRate
          });
        }
      });
      
      // המלצות אוטומטיות לקטגוריות נפוצות
      if (expenses.food && expenses.food > 0.2 * monthlyIncome) {
        recommendations.push({
          priority: "medium",
          description: "הפחתת הוצאות על מזון על ידי תכנון ארוחות מראש וצמצום אוכל מוכן",
          potentialSavings: expenses.food * 0.15
        });
      }
      
      if (expenses.entertainment && expenses.entertainment > 0.1 * monthlyIncome) {
        recommendations.push({
          priority: "medium",
          description: "חיפוש אלטרנטיבות זולות יותר לבידור ופנאי",
          potentialSavings: expenses.entertainment * 0.2
        });
      }
      
      if (expenses.shopping && expenses.shopping > 0.15 * monthlyIncome) {
        recommendations.push({
          priority: "medium",
          description: "הפחתת קניות לא חיוניות והגבלת קניות אימפולסיביות",
          potentialSavings: expenses.shopping * 0.25
        });
      }
      
      // חישוב סך החיסכון הפוטנציאלי מכל ההמלצות
      const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);
      
      // יצירת תרשים ויזואלי של התקציב (מחרוזת ASCII פשוטה)
      let budgetChart = "תרשים תקציב:\n";
      budgetChart += `הכנסה [${"=".repeat(20)}] 100%\n`;
      
      sortedExpenses.forEach(item => {
        const barLength = Math.round(item.percentOfIncome / 5); // כל 5% = 1 תו
        budgetChart += `${item.category} [${"=".repeat(barLength)}${" ".repeat(20 - barLength)}] ${item.percentOfIncome.toFixed(1)}%\n`;
      });
      
      const savingsBarLength = Math.round(currentSavingsRatio / 5);
      budgetChart += `חיסכון [${"=".repeat(savingsBarLength)}${" ".repeat(20 - savingsBarLength)}] ${currentSavingsRatio.toFixed(1)}%\n`;
      
      return {
        monthlyIncome: monthlyIncome,
        totalExpenses: totalExpenses,
        disposableIncome: disposableIncome,
        currentSavingsRatio: currentSavingsRatio.toFixed(1),
        targetSavingsRatio: targetSavingsRatio.toFixed(1),
        isGoalFeasible: isGoalFeasible,
        topExpenses: sortedExpenses.slice(0, 5), // 5 ההוצאות הגדולות ביותר
        recommendations: recommendations,
        totalPotentialSavings: Math.round(totalPotentialSavings),
        budgetChart: budgetChart,
        message: `ניתוח התקציב מראה שמתוך הכנסה חודשית של ${monthlyIncome.toLocaleString()} ₪, ההוצאות מסתכמות ב-${totalExpenses.toLocaleString()} ₪, מה שמותיר ${disposableIncome.toLocaleString()} ₪ (${currentSavingsRatio.toFixed(1)}%) לחיסכון. ${recommendations.length > 0 ? 'זיהינו פוטנציאל לחסוך עוד ' + Math.round(totalPotentialSavings).toLocaleString() + ' ₪ בחודש על ידי יישום ההמלצות.' : ''}`
      };
    } catch (error) {
      logger.error('Error in budget analyzer:', error);
      return `Error analyzing budget: ${error.message}`;
    }
  },
});

/**
 * כלי לניתוח הרגלים פיננסיים
 */
const habitAnalyzerTool = new StructuredTool({
  name: 'habit_analyzer',
  description: 'ניתוח הרגלים פיננסיים וזיהוי דפוסי התנהגות',
  schema: z.object({
    spendingPatterns: z.record(z.number()).describe('דפוסי הוצאה לפי קטגוריה או סיטואציה'),
    savingBehavior: z.enum(['regular', 'irregular', 'none']).describe('דפוס החיסכון: regular=קבוע, irregular=לא קבוע, none=אין'),
    planningHorizon: z.enum(['short', 'medium', 'long']).describe('אופק תכנון פיננסי: short=קצר, medium=בינוני, long=ארוך'),
    emotionalTriggers: z.array(z.string()).describe('טריגרים רגשיים שמשפיעים על החלטות פיננסיות'),
    procrastination: z.enum(['low', 'medium', 'high']).describe('רמת דחיינות בהחלטות פיננסיות: low=נמוכה, medium=בינונית, high=גבוהה'),
  }),
  async func({ spendingPatterns, savingBehavior, planningHorizon, emotionalTriggers, procrastination }) {
    try {
      // ניתוח דפוסי הוצאה
      const spendingCategories = Object.keys(spendingPatterns);
      const totalSpending = Object.values(spendingPatterns).reduce((sum, amount) => sum + amount, 0);
      
      // זיהוי קטגוריות בעייתיות (יותר מ-30% מסך ההוצאות)
      const problematicCategories = spendingCategories
        .filter(category => (spendingPatterns[category] / totalSpending) > 0.3)
        .map(category => ({
          category,
          amount: spendingPatterns[category],
          percentage: (spendingPatterns[category] / totalSpending) * 100
        }));
      
      // ניתוח דפוסי חיסכון
      const savingStrength = {
        'regular': 'חזק',
        'irregular': 'בינוני',
        'none': 'חלש'
      };
      
      // ניתוח אופק תכנון
      const planningStrength = {
        'short': 'מצומצם',
        'medium': 'בינוני',
        'long': 'רחב'
      };
      
      // ניתוח רמת דחיינות
      const procrastinationImpact = {
        'low': 'מינימלית',
        'medium': 'משמעותית',
        'high': 'קריטית'
      };
      
      // זיהוי הטיות התנהגותיות נפוצות
      const biases = [];
      
      if (procrastination === 'high') {
        biases.push({
          name: "הטיית הדחיינות (Present Bias)",
          description: "העדפת הנאה מיידית על פני רווח עתידי",
          impact: "דחיית החלטות פיננסיות חשובות ואיחור בתחילת חיסכון"
        });
      }
      
      if (problematicCategories.length > 0) {
        biases.push({
          name: "הטיית העיגון (Anchoring Bias)",
          description: "הסתמכות על מידע ראשוני או על השוואה לא רלוונטית בקבלת החלטות",
          impact: "הוצאות גבוהות מדי בקטגוריות מסוימות בגלל נקודת ייחוס שגויה"
        });
      }
      
      if (emotionalTriggers.length > 2) {
        biases.push({
          name: "הטיית רגשית (Emotional Bias)",
          description: "קבלת החלטות פיננסיות על בסיס רגשי במקום רציונלי",
          impact: "הוצאות לא מתוכננות בתגובה לטריגרים רגשיים"
        });
      }
      
      if (planningHorizon === 'short') {
        biases.push({
          name: "מיופיה פיננסית (Financial Myopia)",
          description: "קושי להתייחס לעתיד הרחוק",
          impact: "חוסר תכנון ארוך טווח והשקעה לא מספקת בפנסיה וחסכונות"
        });
      }
      
      // בניית המלצות התנהגותיות
      const behavioralRecommendations = [];
      
      if (savingBehavior !== 'regular') {
        behavioralRecommendations.push({
          trigger: "חיסכון לא סדיר",
          intervention: "הגדרת תשלום קבוע אוטומטי לחיסכון במועד קבלת המשכורת",
          principle: "התערבות מבנית - הפיכת החיסכון לאוטומטי ובלתי נראה"
        });
      }
      
      if (procrastination === 'high' || procrastination === 'medium') {
        behavioralRecommendations.push({
          trigger: "דחיינות בהחלטות פיננסיות",
          intervention: "חלוקת החלטות גדולות לצעדים קטנים עם דדליינים ספציפיים",
          principle: "הפחתת מורכבות - הקטנת החסמים והפיכת המשימות לברורות ופשוטות"
        });
      }
      
      if (emotionalTriggers.includes('stress') || emotionalTriggers.includes('anxiety')) {
        behavioralRecommendations.push({
          trigger: "הוצאות בתגובה למתח וחרדה",
          intervention: "הגדרת כלל 24 שעות המתנה לפני רכישות מעל סכום מסוים",
          principle: "יצירת הפרדה - מתן זמן לשיקול דעת רציונלי במקום החלטה רגשית"
        });
      }
      
      if (planningHorizon === 'short') {
        behavioralRecommendations.push({
          trigger: "אופק תכנון קצר",
          intervention: "הפעלת תרגיל דמיון מודרך עם העצמי העתידי",
          principle: "התחברות רגשית לעתיד - חיזוק הקשר בין ההווה והעתיד"
        });
      }
      
      if (problematicCategories.length > 0) {
        behavioralRecommendations.push({
          trigger: `הוצאות גבוהות בקטגוריה: ${problematicCategories[0].category}`,
          intervention: "ניהול תקציב נפרד ייעודי לקטגוריה עם הגבלה ברורה",
          principle: "חשבונות מנטליים - הפרדת כספים למטרות ספציפיות"
        });
      }
      
      // יצירת דירוג הבריאות הפיננסית ההתנהגותית
      let behavioralScore = 0;
      
      // ניקוד לפי דפוס חיסכון (0-33 נקודות)
      if (savingBehavior === 'regular') behavioralScore += 33;
      else if (savingBehavior === 'irregular') behavioralScore += 16;
      
      // ניקוד לפי אופק תכנון (0-33 נקודות)
      if (planningHorizon === 'long') behavioralScore += 33;
      else if (planningHorizon === 'medium') behavioralScore += 16;
      
      // ניקוד לפי דחיינות (0-34 נקודות)
      if (procrastination === 'low') behavioralScore += 34;
      else if (procrastination === 'medium') behavioralScore += 17;
      
      // קביעת דירוג
      let behavioralRating;
      if (behavioralScore >= 85) behavioralRating = "מצוין";
      else if (behavioralScore >= 70) behavioralRating = "טוב";
      else if (behavioralScore >= 50) behavioralRating = "בינוני";
      else if (behavioralScore >= 30) behavioralRating = "דורש שיפור";
      else behavioralRating = "דורש שיפור משמעותי";
      
      return {
        problematicCategories,
        savingStrength: savingStrength[savingBehavior],
        planningStrength: planningStrength[planningHorizon],
        procrastinationImpact: procrastinationImpact[procrastination],
        emotionalTriggers,
        identifiedBiases: biases,
        behavioralRecommendations,
        behavioralScore,
        behavioralRating,
        message: `ניתוח ההרגלים הפיננסיים שלך מעלה ציון התנהגותי של ${behavioralScore}/100 (${behavioralRating}). דפוס החיסכון שלך ${savingStrength[savingBehavior]}, אופק התכנון ${planningStrength[planningHorizon]}, והשפעת הדחיינות ${procrastinationImpact[procrastination]}. זיהינו ${biases.length} הטיות משמעותיות, ו-${behavioralRecommendations.length} התערבויות מומלצות.`
      };
    } catch (error) {
      logger.error('Error in habit analyzer:', error);
      return `Error analyzing financial habits: ${error.message}`;
    }
  },
});

// יצירת מערך של כל הכלים הזמינים
const tools = [
  financialCalculatorTool,
  futureValueTool,
  mortgageCalculatorTool,
  mfplCalculatorTool,
  crisisSimulatorTool,
  budgetAnalyzerTool,
  habitAnalyzerTool
];

// פונקציה ליצירת תהליך שימוש בכלים עבור הסוכנים
const createToolUseChain = (tools) => {
  const llm = new ChatOpenAI({
    openAIApiKey: config.openai.apiKey,
    modelName: config.openai.modelName,
    temperature: 0
  });
  
  const agent = createToolUseAgent({
    llm,
    tools
  });
  
  return AgentExecutor.fromAgentAndTools({
    agent,
    tools
  });
};

module.exports = {
  tools,
  createToolUseChain,
  financialCalculatorTool,
  futureValueTool,
  mortgageCalculatorTool,
  mfplCalculatorTool,
  crisisSimulatorTool,
  budgetAnalyzerTool,
  habitAnalyzerTool
};