const OrchestratorService = require('./../ai-orchestrator/orchestratorService.js');
const CoreAdvisors = require('./../../configs/advisors-core');
const EmotionalAdvisors = require('./../../configs/advisors-emotional');
const SystemAdvisors = require('./../../configs/advisors-system');
const { HumanMessage, SystemMessage, AIMessage, BaseMessage } = require('@langchain/core/messages');
const { sanitizeMessages } = require('./../utils/sanitizeMessages')
const { toLangchainMessages } = require('../utils/messageUtils');

const allAdvisorsList = [
  ...CoreAdvisors,
  ...EmotionalAdvisors,
  ...SystemAdvisors
];

class AdvisorEngine {
  getAllAdvisorsJS() {
    return allAdvisorsList.map(a => ({
      ...a,
      expertise: a.expertise && Array.isArray(a.expertise)
        ? a.expertise
        : a.description
          ? [a.description]
          : ['לא צוינה מומחיות']
    }));
  }

  getAdvisorById(advisorId) {
    return allAdvisorsList.find(a => a.advisorId === advisorId);
  }

  getOpeningMessage() {
    return `שלום! אני אופק, מנהל צוות היועצים ב"אופק פיננסי 360°". 

אשמח ללוות אותך בבניית תמונה פיננסית כוללת שתתאים לצרכים האישיים שלך. בעזרת צוות היועצים המומחים שלנו, נוכל לתכנן את כל טווחי הזמן - מהתקציב החודשי השוטף ועד תכנון פרישה הוליסטי.

לפני שנתחיל, אשמח להכיר אותך קצת:
1. איך תרצה/י שאפנה אליך? (שם)
2. מה גילך כיום?
3. מה המצב המשפחתי שלך? (רווק/ה, נשוי/אה, עם ילדים וכו')
4. האם את/ה עובד/ת כשכיר/ה או עצמאי/ת?

לאחר מכן, נוכל להתחיל לבחון את המצב הפיננסי שלך ולהתאים לך תכנית מותאמת אישית.`;
  }

  /**
   * זיהוי מהיר לפי מילות מפתח
   */
  detectAdvisorByMessage(userMessage) {
    return detectRelevantAdvisor(userMessage, allAdvisorsList);
  }

  /**
   * זיהוי מבוסס GPT לפי ההיסטוריה של השיחה
   * @param {Array} history - מערך הודעות (role + content)
   * @returns {Promise<string|null>} advisorId
   */
  async detectAdvisorByContext({ message, summary, hints }, model) {
    const systemPrompt = `אתה עוזר חכם שתפקידו לקבוע מי היועץ המתאים ביותר להמשך השיחה.
  להלן רשימת היועצים האפשריים:
  ${allAdvisorsList.map(a => `- ${a.advisorId}`).join('\n')}
  
  פרטי השיחה עד כה:
  ${summary}
  
  הודעה אחרונה מהמשתמש:
  ${message}
  
  רמזים נוספים:
  ${hints.isFutureSelf ? 'המשתמש מדבר על עתידו האישי.' : ''}
  ${hints.isEmotional ? 'נראה שהמשתמש מביע רגשות או לחץ.' : ''}
  
  ענה רק ב־advisorId. בלי הסברים.`

    const messages = [new SystemMessage(systemPrompt)];
    const result = await model.invoke(messages);
    const advisorId = result.content.trim().toLowerCase();
    return allAdvisorsList.find(a => a.advisorId === advisorId)?.advisorId || null;
  }

  getRecommendedAdvisors(userInput, userAge) {
    const allAdvisors = [...CoreAdvisors, ...EmotionalAdvisors, ...SystemAdvisors];
    const lowerInput = userInput.toLowerCase();
    const matches = [];

    for (const advisor of allAdvisors) {
      const keywordHits = advisor.triggerKeywords.filter(keyword =>
        lowerInput.includes(keyword.toLowerCase())
      );

      const ageMatch = advisor.ageGroups?.some(group => {
        const [min, max] = group.split('-').map(Number);
        return !isNaN(min) && !isNaN(max) && userAge >= min && userAge <= max;
      }) ?? true;

      if (keywordHits.length > 0 && ageMatch) {
        matches.push({
          advisorId: advisor.advisorId,
          name: advisor.name,
          description: advisor.description,
          keywordHits,
          relevance: keywordHits.length
        });
      }
    }

    // ממיינים לפי כמות הטריגרים שהתאימו
    return matches.sort((a, b) => b.relevance - a.relevance);
  }


  async suggestAdvisorHybrid(userMessage, userAge, history, model, advisorsList) {
    const meaningfulMessages = this.filterMeaningfulMessages(history);

    // אם אין מספיק הקשר - חוזרים ליועץ הראשי
    if (meaningfulMessages.length < 2) {
      return {
        advisorId: 'strategy',
        method: 'insufficient-context',
        support: [],
        topAlternative: null,
        gptSuggestion: null,
        keywordMatches: [],
        explain: this.explainAdvisorChoice({
          advisorId: 'strategy',
          method: 'insufficient-context',
          support: []
        })
      };
    }

    const keywordMatches = this.getRecommendedAdvisors(userMessage, userAge);
    const stageHints = this.detectStageHints(history);
    const historySummary = this.summarizeHistoryForAdvisor(history);

    // הפעלת שני מודלים: הישן והחכם
    const gptSuggestionOld = await this.detectAdvisorByContext({
      message: userMessage,
      summary: historySummary,
      hints: stageHints
    }, model);

    const currentAdvisorId = this.getCurrentAdvisorFromHistory(history);
    const gptSuggestionSmart = await this.classifyAdvisorSmart(userMessage, advisorsList, model, currentAdvisorId);

    // בחירה חכמה לפי הצלבה או עדיפות לחכם
    const gptSuggestion = (gptSuggestionOld === gptSuggestionSmart)
      ? gptSuggestionSmart
      : gptSuggestionSmart || gptSuggestionOld;

    // שקלול ניקוד – מיזוג מילות מפתח עם בחירת GPT
    const merged = keywordMatches.map(k => ({
      ...k,
      score: (k.advisorId === gptSuggestion ? 2 : 0) + (k.keywordHits?.length || 0)
    })).sort((a, b) => b.score - a.score);

    const advisorId = merged[0]?.advisorId || gptSuggestion || 'strategy';

    const method =
      gptSuggestionSmart && gptSuggestionOld && gptSuggestionSmart === gptSuggestionOld
        ? 'gpt+smart+keywords'
        : gptSuggestionSmart
          ? 'smart+keywords'
          : gptSuggestionOld && keywordMatches.find(a => a.advisorId === gptSuggestionOld)
            ? 'gpt+keywords'
            : keywordMatches.length
              ? 'keywords'
              : 'gpt only';

    const previouslyAssigned = [...new Set(history
        .filter(m => m.sender === 'system' && m.advisorId && m.advisorId !== 'strategy')
        .map(m => m.advisorId))];

      let finalAdvisorId = advisorId;

      // אם היועץ שנבחר הוא 'strategy' ויש יועצים קודמים – ננסה להחליף
      if (advisorId === 'strategy' && previouslyAssigned.length > 0) {
        const altAdvisor = merged[1]?.advisorId;

        if (altAdvisor && altAdvisor !== 'strategy' && !previouslyAssigned.includes(altAdvisor)) {
          finalAdvisorId = altAdvisor;
        } else {
          // fallback: נחזור ליועץ האחרון שהשתמשנו בו שלא היה 'strategy'
          finalAdvisorId = previouslyAssigned[previouslyAssigned.length - 1] || 'strategy';
        }
      }

    return {
      advisorId: finalAdvisorId,
      method,
      support: merged[0]?.keywordHits || [],
      topAlternative: merged[1] || null,
      gptSuggestion,
      keywordMatches,
      explain: this.explainAdvisorChoice({
        advisorId: finalAdvisorId,
        method,
        support: merged[0]?.keywordHits || []
      })
    };
  }

  // NOTE: Removed shuffle() and findNewAdvisorExcluding() - advisor selection is now handled by LLM


  getCurrentAdvisorFromHistory(history) {
    const lastAdvisorMsg = [...history]
      .reverse()
      .find(m => m.sender === 'system' && m.advisorId && m.advisorId !== 'strategy');
    return lastAdvisorMsg?.advisorId ?? null;
  }


  async classifyAdvisorSmart(message, advisorsList, model,currentAdvisorId ) {
    if (!model || typeof model.invoke !== 'function') {
      throw new Error('Model instance with .invoke function is required');
    }

    const advisorsForPrompt = advisorsList.map(a => {
      const expertiseList = Array.isArray(a.expertise)
        ? a.expertise
        : a.description
          ? [a.description]
          : ['לא צוינה מומחיות'];
      return `- ${a.name}: ${expertiseList.join(', ')}`;
    }).join('\n');

    const currentAdvisor = advisorsList.find(a => a.id === currentAdvisorId);
    const currentAdvisorName = currentAdvisor?.name;

    const prompt = `
      בהתבסס על ההודעה הבאה, איזה יועץ הכי מתאים לטפל בנושא?

      הודעת משתמש:
      """${message}"""

      רשימת היועצים:
      ${advisorsForPrompt}

      ${currentAdvisorName
        ? `שים לב: המשתמש כבר משויך ליועץ "${currentAdvisorName}". אל תחזיר אותו ליועץ "אופק – מנהל יועצים פיננסיים".`
        : `אם המשתמש כבר משויך ליועץ אחר, אין לבחור מחדש ב"אופק – מנהל יועצים פיננסיים".`
      }

      בחר יועץ אחד בלבד מתוך הרשימה. השב בפורמט JSON בלבד כך:
      { "advisor": "שם היועץ מתוך הרשימה בלבד" }

      אם אין התאמה ברורה, רשום:
      { "advisor": null }
      `;

    const messages = toLangchainMessages([
      { role: 'system', content: 'אתה מנתח טקסטים ומפנה ליועץ פיננסי מתאים מתוך רשימה לפי תוכן ההודעה. הקפד לבחור אך ורק יועצים מתוך הרשימה הנתונה.' },
      { role: 'user', content: prompt }
    ]);

    const response = await model.invoke(messages);
    let text = response?.content?.trim() ?? '';

    // סינון עטיפת markdown כמו ```json או ```
    if (text.startsWith('```')) {
      text = text.replace(/```(?:json)?/g, '').trim();
    }

    try {
      const parsed = JSON.parse(text);
      const name = parsed.advisor;
      const advisor = advisorsList.find(a => a.name === name);

      if (!advisor && name) {
        console.warn(`⚠️ היועץ "${name}" לא נמצא ברשימה. בדוק שהשמות מעודכנים.`);
      }

      return advisor?.id ?? null;
    } catch (err) {
      console.error('❌ classifyAdvisorSmart – שגיאת פיענוח JSON:', text);
      return null;
    }
  }



  filterMeaningfulMessages(history) {
    return (history || []).filter(m =>
      m.role === 'user' &&
      typeof m.content === 'string' &&
      m.content.trim().length > 20
    );
  }

  detectStageHints(history) {
    const fullText = (history || []).map(m => m.content).join('\n').toLowerCase();
    return {
      isFutureSelf: /בעתיד|פרישה|חזון|איפה אני בעוד|מטרות לטווח ארוך/.test(fullText),
      isEmotional: /מרגיש|מתוסכל|מפחד|מודאג|אבוד|בדיכאון|כועס/.test(fullText)
    };
  }

  summarizeHistoryForAdvisor(history) {
    const lastMessages = history.slice(-5).map(m => `${m.role === 'user' ? 'משתמש' : 'יועץ'}: ${m.content}`);
    return lastMessages.join('\n');
  }

  explainAdvisorChoice({ advisorId, method, support }) {
    if (method === 'insufficient-context') {
      return 'בחרנו ביועץ הראשי כדי להתחיל בבניית תמונה פיננסית כוללת, מכיוון שאין עדיין הקשר מספיק.';
    }

    if (support.length > 0) {
      return `היועץ נבחר בגלל התאמה למילות מפתח שזוהו כמו: ${support.join(', ')}`;
    }

    if (method === 'gpt only') {
      return 'היועץ נבחר על סמך ניתוח ההקשר הכללי של השיחה באמצעות המודל.';
    }

    return 'היועץ נבחר באמצעות שילוב בין מילות מפתח וניתוח שיחה.';
  }

}

module.exports = new AdvisorEngine();
