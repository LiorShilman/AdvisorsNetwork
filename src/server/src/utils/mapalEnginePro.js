// 📁 mapalEnginePro.js – גרסה מקצועית ומדורגת למדד מפ"ל 2.0
const { HumanMessage, SystemMessage, AIMessage, BaseMessage } = require('@langchain/core/messages');

const DOMAIN_KEYS = {
  strategy: 'planning',
  budget: 'planning',
  mortgage: 'planning',
  data: 'planning',
  special: 'planning',

  risk: 'protection',
  selfemployed: 'protection',
  career: 'protection',

  pension: 'retirement',
  altretire: 'retirement',
  intergen: 'retirement',

  investments: 'investment',
  abundance: 'investment',
  young: 'investment',
  altinvest: 'investment',

  behavior: 'behavior',
  meaning: 'behavior',
  futureself: 'behavior'
};

const MAPAL_FIELD_KEYS = {
  strategy: 'financialFoundations',
  budget: 'financialFoundations',
  mortgage: 'mortgageOptimization',
  data: 'dataBasedManagement',
  special: 'specialSituationsResilience',

  risk: 'legalAndInsurance',
  selfemployed: 'legalAndInsurance',
  career: 'incomeGrowth',

  pension: 'pensionPlanning',
  altretire: 'retirementAlternatives',
  intergen: 'intergenerationalTransfer',

  investments: 'assetDiversification',
  abundance: 'abundanceMindset',
  young: 'assetDiversification',
  altinvest: 'alternativeInvestments',

  behavior: 'behaviorAndHabits',
  meaning: 'resourceLifeQualityBalance',
  futureself: 'abundanceMindset'
};

const DOMAIN_WEIGHTS = {
  planning: 0.20,
  protection: 0.15,
  investment: 0.25,
  retirement: 0.15,
  behavior: 0.25
};

const STAGE_LABELS = [
  { threshold: 0, label: "בהתחלה – מתחילים להבין את המצב" },
  { threshold: 25, label: "בשלב מיפוי בסיסי – יש כיוון ראשוני" },
  { threshold: 50, label: "בונים תשתית – מתחילים לפעול" },
  { threshold: 75, label: "צמיחה פעילה – ניהול עצמאי ואפקטיבי" },
  { threshold: 90, label: "מוכנות פיננסית מלאה – שליטה ובקרה" }
];

function validateAdvisorDomainMapping(advisorId) {
  if (!DOMAIN_KEYS.hasOwnProperty(advisorId)) {
    console.warn(`⚠️ היועץ "${advisorId}" אינו ממופה לדומיין במערך DOMAIN_KEYS`);
    return false;
  }
  return true;
}

// מיפוי לעוצמת השפעה – ניתן להרחיב בעתיד
const IMPACT_LEVELS = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  QUANTUM: 5
};

const impactVisuals = {
  0: '🔘 ללא השפעה',
  1: '🟡 השפעה קלה',
  2: '🟠 התקדמות משמעותית',
  3: '🟢 קפיצה תפיסתית',
  5: '🚀 קפיצה קוונטית'
};

async function updateMapalScoreWithImpactModel(conversation, advisorId, aiText, model) {
  ensureMapalStructure(conversation);

  const fieldKey = MAPAL_FIELD_KEYS[advisorId];
  if (!fieldKey || !aiText || typeof aiText !== 'string') {
    return { updated: false, impactLevel: 0 };
  }

  const domain = DOMAIN_KEYS?.[advisorId] || 'general'; // לשמירה בהיסטוריה בלבד

  const messages = Array.isArray(conversation.history) ? conversation.history : [];
  const historySummary = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? '🧑' : '🧠'} ${m.content}`)
    .slice(-20)
    .join('\n');

  const prompt = `
🧠 **מערכת הערכת מפ״ל (מדד פוטנציאל לצמיחה וליווי)**

📁 דומיין: **${domain}**

📚 היסטוריית שיחה:
${historySummary}

🆕 תשובת ה-AI האחרונה:
${aiText}

🎯 קבע את עוצמת ההשפעה על התקדמות המשתמש בתחום הזה בלבד:
- NONE
- LOW
- MEDIUM
- HIGH
- QUANTUM
  `.trim();

  try {
    const result = await model.invoke([new SystemMessage(prompt)]);
    const rawImpact = (result?.content || '').trim().toUpperCase();

    const impactMatch = Object.keys(IMPACT_LEVELS).find(level =>
      new RegExp(`\\b${level}\\b`).test(rawImpact)
    ) || 'NONE';

    const impactValue = IMPACT_LEVELS[impactMatch];

    const prev = Number.isFinite(conversation.state.mapalScore[fieldKey])
      ? conversation.state.mapalScore[fieldKey]
      : 0;
    const next = Math.min(prev + impactValue, 10);

    if (impactValue > 0) {
      conversation.state.mapalScore[fieldKey] = next;
      conversation.state.mapalScore.readiness = calculateWeightedMapalReadiness(conversation.state.mapalScore).percent;

      addMapalHistoryEntry(conversation, domain, prev, next, advisorId, aiText, impactMatch);

      return { updated: true, impactLevel: impactValue };
    }

    return { updated: false, impactLevel: 0 };
  } catch (err) {
    console.error('❌ שגיאה ב-updateMapalScoreWithImpactModel:', err);
    return { updated: false, impactLevel: 0 };
  }
}



function renderRow(label, value) {
  if (typeof value !== 'number') value = 0;
  const status = getMapalStatusLabel(value);
  return `| ${label} | ${value}/5 | ${'█'.repeat(value)}${'░'.repeat(5 - value)} | ${status} |`;
}

function getMapalStatusLabel(value) {
  if (value >= 5) return 'מוכן!';
  if (value >= 4) return 'טוב מאוד';
  if (value >= 3) return 'חלקי';
  if (value >= 2) return 'חסר';
  return 'תחום חשוב!';
}

function getReadinessStage(score) {
  if (score >= 90) return 'שליטה פיננסית מלאה';
  if (score >= 75) return 'מתקדם – יישום בפועל';
  if (score >= 50) return 'בדרך – הבנה וצעדים';
  if (score >= 25) return 'מגובש – הבנה בסיסית';
  return 'בהתחלה – מתחילים להבין את המצב';
}

function getMapalRecommendation(score) {
  const domains = [
    { key: 'planning', label: 'תכנון כולל' },
    { key: 'protection', label: 'הגנה וסיכונים' },
    { key: 'investment', label: 'השקעות' },
    { key: 'retirement', label: 'פרישה' },
    { key: 'behavior', label: 'תודעה והתנהגות' }
  ];

  const weakest = domains.sort((a, b) => (score[a.key] || 0) - (score[b.key] || 0))[0];
  return `כדאי להתמקד בשיפור תחום **${weakest.label}**.`;
}

function ensureMapalStructure(conversation) {
  if (!conversation.state.mapalScore) {
    conversation.state.mapalScore = {};
  }

  const defaults = {
    planning: 0, protection: 0, investment: 0, retirement: 0, behavior: 0,
    cashflow: 0, credit: 0, savings: 0, housing: 0, career: 0,
    tax: 0, insurance: 0, legal: 0, entrepreneurship: 0,
    readiness: 0,
    history: []
  };

  for (const key in defaults) {
    if (typeof conversation.state.mapalScore[key] !== 'number') {
      conversation.state.mapalScore[key] = defaults[key];
    }
  }
}

const domainLabels = {
  planning: '🧭 תכנון כולל',
  protection: '🛡️ הגנה וסיכון',
  investment: '📈 השקעות',
  retirement: '🏖️ פרישה',
  behavior: '🧠 תודעה והתנהגות'
};


async function updateMapalScoreSmart(conversation, advisorId, aiText, model) {
  ensureMapalStructure(conversation);

  const domain = DOMAIN_KEYS[advisorId];
  if (!domain || !aiText || typeof aiText !== 'string') return false;

  const historyContext = getRecentUserMessages(conversation, 3);
  const prompt = `
אתה מערכת חכמה למדידת קידום פיננסי לפי מדד מפ״ל.
עליך להעריך את רמת ההתקדמות של המשתמש בדומיין הבא:

דומיין: ${domain}

— — — — — — — — — — — — — — — —
📜 הקשר קודם מהשיחה:
${historyContext}

💬 תשובת המערכת האחרונה:
${aiText}
— — — — — — — — — — — — — — — —

🔍 האם יש כאן קידום ממשי?
- צעד תודעתי (תובנה, הכרה)
- צעד רגשי (פתיחות, מוכנות)
- צעד מעשי (החלטה, התחייבות)

דרג את ההתקדמות באחת מהאופציות:
- 0 – אין קידום
- 1 – קידום קטן או המשך עקבי
- 2 – קידום ממשי, החלטה או גילוי תודעתי
- 3 – פריצת דרך משמעותית או פעולה יוצאת דופן

ענה רק במספר 0–3.
  `;

  try {
    const result = await model.invoke([new SystemMessage(prompt)]);
    const score = parseInt((result?.content || '').trim());
    if (isNaN(score) || score < 0 || score > 3) return false;

    const prev = conversation.state.mapalScore[domain];
    const next = Math.min(prev + score, 5);
    if (next === prev) return false;

    conversation.state.mapalScore[domain] = next;
    conversation.state.mapalScore.readiness = calculateMapalReadiness(conversation.state.mapalScore);
    addMapalHistoryEntry(conversation, domain, prev, next, advisorId, aiText, 'ai');

    return true;
  } catch (err) {
    console.error('❌ שגיאה בהפעלת updateMapalScoreSmart:', err);
    return false;
  }
}

function getRecentUserMessages(conversation, count = 3) {
  if (!Array.isArray(conversation.history)) return '';
  const recent = conversation.history
    .filter(msg => msg.role === 'user')
    .slice(-count)
    .map(msg => `- ${msg.content}`);
  return recent.join('\n');
}


function updateMapalScore(conversation, advisorId, answeredCount = 1) {
  ensureMapalStructure(conversation);

  if (validateAdvisorDomainMapping(advisorId)) {
    const domain = DOMAIN_KEYS[advisorId];
    if (domain && typeof conversation.state.mapalScore[domain] === 'number') {
      conversation.state.mapalScore[domain] += answeredCount;
      if (conversation.state.mapalScore[domain] > 5) {
        conversation.state.mapalScore[domain] = 5;
      }
    }

    const readiness = calculateMapalReadiness(conversation.state.mapalScore);
    conversation.state.mapalScore.readiness = readiness;
    conversation.state.mapalScore.history.push({
      timestamp: new Date().toISOString(),
      snapshot: { ...conversation.state.mapalScore }
    });
  }
}

function calculateWeightedMapalReadiness(mapalScore) {
  const domainWeights = {
    financialFoundations: 12,
    behaviorAndHabits: 8,
    pensionPlanning: 15,
    assetDiversification: 15,
    alternativeInvestments: 5,
    mortgageOptimization: 8,
    legalAndInsurance: 7,
    incomeGrowth: 7,
    specialSituationsResilience: 8,
    dataBasedManagement: 5,
    resourceLifeQualityBalance: 6,
    abundanceMindset: 6,
    intergenerationalTransfer: 4,
    retirementAlternatives: 4
  };

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(domainWeights)) {
    const value = Number.isFinite(mapalScore[key]) ? mapalScore[key] : 0;
    totalWeightedScore += value * weight;
    totalWeight += 10 * weight; // סקלה של 10 נקודות לכל תחום
  }

  const averageScore = totalWeightedScore / totalWeight * 10;
  const percent = Math.round((averageScore / 10) * 100);

  return {
    averageScore: Number(averageScore.toFixed(1)),
    percent
  };
}

function calculateMapalReadiness(mapalScore) {
  const domains = [
    'planning', 'protection', 'investment', 'retirement', 'behavior',
    'cashflow', 'credit', 'savings', 'housing', 'career',
    'tax', 'insurance', 'legal', 'entrepreneurship'
  ];

  const validScores = domains.map(d => Number.isFinite(mapalScore[d]) ? mapalScore[d] : 0);
  const total = validScores.reduce((sum, s) => sum + s, 0);
  const average = total / domains.length;
  return Math.round(average);
}

function renderMapalMarkdown(mapalScore, impactLevel = null, previousScore = null) {
  const domainLabels = {
    financialFoundations: { label: 'יסודות פיננסיים', weight: 12, icon: '💰' },
    behaviorAndHabits: { label: 'התנהגות והרגלים פיננסיים', weight: 8, icon: '🧠' },
    pensionPlanning: { label: 'תכנון פנסיוני', weight: 15, icon: '👴' },
    assetDiversification: { label: 'מגוון נכסים והשקעות', weight: 15, icon: '📊' },
    alternativeInvestments: { label: 'השקעות אלטרנטיביות וחדשנות', weight: 5, icon: '🔮' },
    mortgageOptimization: { label: 'אופטימיזציית משכנתא ונדל״ן', weight: 8, icon: '🏠' },
    legalAndInsurance: { label: 'הכנה משפטית וביטוחית', weight: 7, icon: '🛡️' },
    incomeGrowth: { label: 'מקורות הכנסה וצמיחה', weight: 7, icon: '📈' },
    specialSituationsResilience: { label: 'עמידות וגמישות למצבים מיוחדים', weight: 8, icon: '🔄' },
    dataBasedManagement: { label: 'ניהול ובקרה מבוססי נתונים', weight: 5, icon: '📱' },
    resourceLifeQualityBalance: { label: 'איזון משאבים-איכות חיים', weight: 6, icon: '⚖️' },
    abundanceMindset: { label: 'תודעת שפע ואמונות כלכליות', weight: 6, icon: '🌟' },
    intergenerationalTransfer: { label: 'העברה בין-דורית ותכנון משפחתי', weight: 4, icon: '👪' },
    retirementAlternatives: { label: 'גמישות ואלטרנטיבות בפרישה', weight: 4, icon: '🌈' }
  };

  // חישוב ציון משוקלל
  const domainKeys = Object.keys(domainLabels);
  let totalWeightedScore = 0;
  let totalWeight = 0;

  domainKeys.forEach(key => {
    const score = typeof mapalScore[key] === 'number' && !isNaN(mapalScore[key]) ? mapalScore[key] : 0;
    const weight = domainLabels[key].weight;
    totalWeightedScore += score * weight;
    totalWeight += weight;
  });

  const weightedAverage = totalWeightedScore / totalWeight;

  // פונקציה לבר התקדמות צבעוני
  const getBar = (score, maxScore = 10) => {
    const segments = 10;
    const filled = Math.round((score / maxScore) * segments);
    
    let bar = '';
    for (let i = 1; i <= segments; i++) {
      if (i <= filled) {
        if (score < 4) bar += '🟥';
        else if (score < 7) bar += '🟨';
        else bar += '🟩';
      } else {
        bar += '⬜';
      }
    }
    return bar;
  };

  // פונקציה למגמה - מותאמת לעברית RTL
  const getTrend = (current, previous) => {
    if (!previous) return '←'; // ללא שינוי בעברית - שמאלה
    if (current > previous) return '↖️'; // עליה בעברית - שמאלה מעלה
    if (current < previous) return '↘️'; // ירידה בעברית - ימינה מטה  
    return '←'; // ללא שינוי - שמאלה
  };

  // קביעת סטטוס כללי
  const getStatus = (score) => {
    if (score >= 8.5) return { text: 'מצוין', emoji: '🟢' };
    if (score >= 7.0) return { text: 'טוב מאוד', emoji: '🟡' };
    if (score >= 5.5) return { text: 'בינוני+', emoji: '🟠' };
    if (score >= 4.0) return { text: 'בינוני', emoji: '🔴' };
    return { text: 'זקוק לשיפור', emoji: '🔴' };
  };

  const status = getStatus(weightedAverage);
  const result = [];
  
  // כותרת ראשית בלבד
  result.push('## 📊 מדד מפ"ל 2.0 - מוכנות פיננסית לפרישה');
  result.push('');
  result.push(`**ציון כולל:** ${weightedAverage.toFixed(1)}/10 ${status.emoji} (${status.text})`);
  result.push('');
  
  // טבלה עיקרית עם ריווח טוב יותר
  result.push('| תחום | ציון | מגמה | מד התקדמות | משקל |');
  result.push('|-------------|----------|----------|------------------------|----------|');
  domainKeys.forEach(key => {
    const domain = domainLabels[key];
    const score = mapalScore[key] || 0;
    const previousDomainScore = previousScore ? previousScore[key] : null;
    const trend = getTrend(score, previousDomainScore);
    const progress = getBar(score, 10);
    
    result.push(`| ${domain.icon} ${domain.label}&nbsp;&nbsp; | &nbsp;${score.toFixed(1)}/10&nbsp; | &nbsp;${trend}&nbsp; | &nbsp;${progress}&nbsp; | &nbsp;${domain.weight}%&nbsp; |`);
  });

  result.push('');

  // רק שלושת הצעדים הקריטיים - ללא חזרות
  const weakest = domainKeys
    .map(key => ({ key, score: mapalScore[key] || 0, domain: domainLabels[key] }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  result.push('### 🎯 שלושת הצעדים הקריטיים לשיפור');
  result.push('');

  const recommendations = {
    financialFoundations: 'בדוק תקציב חודשי והגדל קרן חירום ל-6 חודשים',
    behaviorAndHabits: 'פתח הרגלי חיסכון אוטומטיים',
    pensionPlanning: 'הגדל הפרשות פנסיוניות ל-20.5%',
    assetDiversification: 'גוון תיק השקעות עם אג"ח וקרנות מדדים',
    alternativeInvestments: 'שקול חשיפה מבוקרת (עד 5%) לקריפטו',
    mortgageOptimization: 'בחן מיחזור משכנתא',
    legalAndInsurance: 'עדכן צוואה וייפוי כוח',
    incomeGrowth: 'השקע בהשכלה מקצועית',
    specialSituationsResilience: 'בנה תכנית חירום ל-6+ חודשים',
    dataBasedManagement: 'התחל מעקב חודשי אחר יעדים',
    resourceLifeQualityBalance: 'הגדר יעדי איכות חיים',
    abundanceMindset: 'עבוד על אמונות מגבילות',
    intergenerationalTransfer: 'התחל חינוך פיננסי לילדים',
    retirementAlternatives: 'חקור אפשרויות פרישה חלקית'
  };

  weakest.forEach((item, index) => {
    const priorityEmoji = index === 0 ? '🔴' : index === 1 ? '🟡' : '🟢';
    result.push(`${index + 1}. ${priorityEmoji} **${item.domain.icon} ${item.domain.label}** (${item.score.toFixed(1)}/10)`);
    result.push(`   📝 ${recommendations[item.key]}`);
    result.push('');
  });

  // רמת השפעה אם קיימת
  if (impactLevel) {
    const impactEmojis = {
      'נמוכה': '🟢',
      'בינונית': '🟡', 
      'גבוהה': '🟠',
      'קריטית': '🔴'
    };
    
    result.push('### 💥 עוצמת השפעה על איכות החיים');
    result.push(`${impactEmojis[impactLevel] || '⚪'} **${impactLevel}**`);
    result.push('');
  }

  // סיכום פשוט
  result.push('---');
  result.push('*המדד מתעדכן בזמן אמת עם השיפורים בתכנון הפיננסי*');

  return result.join('\n');
}

function updateMapalScoreByContent(conversation, advisorId, aiResponse) {
  ensureMapalStructure(conversation);

  if (validateAdvisorDomainMapping(advisorId)) {
    const domain = DOMAIN_KEYS[advisorId];
    if (!domain || !aiResponse || typeof aiResponse !== 'string') return;

    const normalized = aiResponse.toLowerCase();

    // חוקים פשוטים לזיהוי התקדמות תוכן ממשית
    const progressIndicators = [
      'צעד הבא שלך הוא',
      'השלב הבא שנמליץ עליו',
      'כדי להתקדם עליך',
      'ההמלצה שלי עבורך כעת',
      'כדאי לבדוק את',
      'עליך לפעול כדי',
      'מציע שתבצע',
      'תוכל לתעדף את',
      'בהתאם לנתונים שלך'
    ];

    const isProgressMade = progressIndicators.some(p => normalized.includes(p.toLowerCase()));

    if (isProgressMade) {
      conversation.state.mapalScore[domain] += 1;
      if (conversation.state.mapalScore[domain] > 5) {
        conversation.state.mapalScore[domain] = 5;
      }

      conversation.state.mapalScore.readiness = calculateMapalReadiness(conversation.state.mapalScore);
    }
  }
}



function addMapalHistoryEntry(conversation, domain, from, to, advisorId, excerpt, method) {
  const safeFrom = Number.isFinite(from) ? from : 0;
  const safeTo = Number.isFinite(to) ? to : 0;

  conversation.state.mapalHistory = conversation.state.mapalHistory || [];

  conversation.state.mapalHistory.push({
    timestamp: new Date().toISOString(),
    domain, // תחום כללי כמו 'retirement', 'investment'
    from: safeFrom,
    to: safeTo,
    method,
    source: advisorId,
    excerpt: excerpt?.slice(0, 300) || ''
  });
}





function logMapalChange(conversation, domain, from, to, source, aiText = '', method = 'auto') {
  if (!domain || from === to) return;

  conversation.state.mapalHistory = conversation.state.mapalHistory || [];

  conversation.state.mapalHistory.push({
    timestamp: new Date().toISOString(),
    domain,
    from,
    to,
    method, // 'auto' / 'fallback' / 'manual'
    source, // לדוגמה: advisorId
    excerpt: aiText.slice(0, 200).trim()
  });
}

function getMapalStage(readiness) {
  for (let i = STAGE_LABELS.length - 1; i >= 0; i--) {
    if (readiness >= STAGE_LABELS[i].threshold) {
      return STAGE_LABELS[i].label;
    }
  }
  return STAGE_LABELS[0].label;
}


module.exports = {
  updateMapalScore,
  calculateMapalReadiness,
  calculateWeightedMapalReadiness,
  getMapalStage,
  renderMapalMarkdown,
  updateMapalScoreByContent,
  logMapalChange,
  validateAdvisorDomainMapping,
  updateMapalScoreSmart,
  updateMapalScoreWithImpactModel,
  DOMAIN_KEYS,
  MAPAL_FIELD_KEYS
};
