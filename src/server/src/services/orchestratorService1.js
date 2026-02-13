// src/services/orchestratorService.js - שירות ניהול רשת היועצים
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { StructuredOutputParser } = require('langchain/output_parsers');
const { z } = require('zod');
const config = require('../../configs/config');
const logger = require('../utils/logger');
const advisorDefinitions = require('../advisors/advisorDefinitions');
const { createToolUseChain } = require('../langchain/tools');
const { MemoryManager } = require('../utils/memory');

class OrchestratorService {
  constructor() {
    // יצירת מודל הבסיס
    this.model = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.modelName,
      temperature: config.openai.temperature,
      verbose: false//config.langchain.verbose
    });

    // יצירת מנהל זיכרון
    this.memoryManager = new MemoryManager();

    // הכנת פארסר למבנה תשובה
    this.responseParser = StructuredOutputParser.fromZodSchema(
      z.object({
        text: z.string().describe("התשובה המלאה שתוצג למשתמש"),
        advisorId: z.string().describe("המזהה של היועץ שנותן את התשובה"),
        processingTime: z.number().optional().describe("זמן עיבוד בשניות"),
        tokens: z.number().optional().describe("מספר הטוקנים בתשובה"),
        model: z.string().optional().describe("מודל ששימש לייצור התשובה"),
        temperature: z.number().optional().describe("ערך הטמפרטורה ששימש"),
        collectedInfo: z.object({
          userProfile: z.object({}).passthrough().optional(),
          financialInfo: z.object({}).passthrough().optional(),
          goals: z.array(
            z.object({
              description: z.string(),
              timeframe: z.enum(["short", "medium", "long"]),
              priority: z.number().min(1).max(5)
            })
          ).optional(),
          concerns: z.array(z.string()).optional()
        }).optional(),
        conversationState: z.object({
          currentAdvisor: z.string().optional(),
          previousAdvisors: z.array(z.string()).optional(),
          pendingAdvisors: z.array(z.string()).optional(),
          conversationPhase: z.enum([
            "initial-mapping", 
            "deep-analysis", 
            "recommendations", 
            "planning",
            "summary"
          ]).optional()
        }).optional(),
        activatedTriggers: z.record(z.array(z.string())).optional(),
        recommendations: z.array(
          z.object({
            text: z.string(),
            advisorId: z.string(),
            category: z.string(),
            priority: z.enum(["low", "medium", "high", "critical"]),
            timeframe: z.enum(["immediate", "short-term", "medium-term", "long-term"])
          })
        ).optional(),
        mfplUpdate: z.object({
          overall: z.number(),
          components: z.object({
            financialFoundations: z.number().optional(),
            behaviorAndHabits: z.number().optional(),
            pensionPlanning: z.number().optional(),
            assetDiversification: z.number().optional(),
            alternativeInvestments: z.number().optional(),
            mortgageOptimization: z.number().optional(),
            legalAndInsurance: z.number().optional(),
            incomeGrowth: z.number().optional(),
            specialSituationsResilience: z.number().optional(),
            dataBasedManagement: z.number().optional(),
            resourceLifeQualityBalance: z.number().optional(),
            abundanceMindset: z.number().optional(),
            intergenerationalTransfer: z.number().optional(),
            retirementAlternatives: z.number().optional()
          })
        }).optional()
      })
    );
  }

  /**
   * עיבוד הודעה מהמשתמש וקבלת תשובה מהיועץ המתאים
   */
  async processMessage(message, conversation) {
    try {
      const startTime = Date.now();
      
      // שליפת זיכרון השיחה
      const memoryKey = conversation._id.toString();
      const history = await this.memoryManager.getConversationHistory(memoryKey);
      
      // קביעת היועץ הנוכחי
      let currentAdvisorId = conversation.state.currentAdvisor || 'strategy';
      
      // נטרול מילות מפתח לזיהוי יועצים רלוונטיים
      const activatedAdvisors = this.identifyRelevantAdvisors(message);
      
      // אם זוהו יועצים חדשים, עדכון רשימת היועצים הממתינים
      if (activatedAdvisors.length > 0 && activatedAdvisors[0] !== currentAdvisorId) {
        logger.debug(`Identified relevant advisors: ${activatedAdvisors.join(', ')}`);
        
        // אם יש יועץ מוביל חדש, נעבור אליו
        if (conversation.state.conversationPhase === 'initial-mapping') {
          // בשלב המיפוי הראשוני, נעבור מיד ליועץ המתאים ביותר
          currentAdvisorId = activatedAdvisors[0];
          logger.debug(`Switching to advisor: ${currentAdvisorId}`);
        } else {
          // בהמשך השיחה, נוסיף את היועצים לתור
          for (const advisorId of activatedAdvisors) {
            if (
              advisorId !== currentAdvisorId && 
              !conversation.state.pendingAdvisors.includes(advisorId) &&
              !conversation.state.previousAdvisors.includes(advisorId)
            ) {
              conversation.state.pendingAdvisors.push(advisorId);
            }
          }
        }
      }
      
      // בניית הפרומפט המלא עבור היועץ הנוכחי
      const advisor = advisorDefinitions[currentAdvisorId];
      const fullPrompt = this.buildFullPrompt(advisor, conversation, message);
      
      // הכנת ההודעות עבור המודל
      const messages = [
        new SystemMessage(fullPrompt),
        ...history,
        new HumanMessage(message)
      ];
      
      // בקשת תשובה מהמודל
      const response = await this.model.invoke(messages);
      
      // פירוק התשובה למבנה מתאים
      let parsedResponse;
      try {
        // ניסיון לפרסר את התשובה ישירות אם היא כבר במבנה JSON
        parsedResponse = this.extractAndParseResponse(response.content);
      } catch (error) {
        logger.warn('Failed to parse direct response, trying with format instructions', error);
        
        // ניסיון נוסף עם הוראות פורמט מפורשות
        const formattedPrompt = `${fullPrompt}\n\nהחזר את התשובה במבנה JSON מדויק לפי הפורמט הבא:
        {
          "text": "התשובה המלאה למשתמש",
          "advisorId": "${currentAdvisorId}",
          "processingTime": 0,
          "collectedInfo": {
            "userProfile": {},
            "financialInfo": {},
            "goals": [],
            "concerns": []
          },
          "conversationState": {
            "currentAdvisor": "",
            "previousAdvisors": [],
            "pendingAdvisors": []
          },
          "activatedTriggers": {},
          "recommendations": []
        }`;
        
        const retryMessages = [
          new SystemMessage(formattedPrompt),
          ...history,
          new HumanMessage(message)
        ];
        
        const retryResponse = await this.model.invoke(retryMessages);
        parsedResponse = this.extractAndParseResponse(retryResponse.content);
      }
      
      // חישוב זמן עיבוד
      const processingTime = (Date.now() - startTime) / 1000;
      parsedResponse.processingTime = processingTime;
      
      // עדכון מודל בשימוש
      parsedResponse.model = config.openai.modelName;
      parsedResponse.temperature = config.openai.temperature;
      
      // עדכון ה-advisorId אם חסר
      if (!parsedResponse.advisorId) {
        parsedResponse.advisorId = currentAdvisorId;
      }
      
      // הוספת ההודעה לזיכרון השיחה
      await this.memoryManager.addToHistory(
        memoryKey,
        new HumanMessage(message),
        new AIMessage(parsedResponse.text)
      );
      
      logger.debug(`Response from advisor ${parsedResponse.advisorId} generated in ${processingTime.toFixed(2)}s`);
      
      return parsedResponse;
    } catch (error) {
      logger.error('Error in orchestratorService.processMessage:', error);
      // החזרת תשובת ברירת מחדל במקרה של שגיאה
      return {
        text: "סליחה, נתקלתי בבעיה בעיבוד השאלה שלך. אנא נסה שוב או נסח את השאלה אחרת.",
        advisorId: conversation.state.currentAdvisor || 'strategy',
        processingTime: 0,
        model: config.openai.modelName,
        temperature: config.openai.temperature
      };
    }
  }

  /**
   * עיבוד הודעה מהמשתמש וקבלת תשובה מהיועץ המתאים
   */
  async generateTitleWithLLM(history) {
    try {

      const systemMessage = {
        role: 'system',
        content: 'צור כותרת קצרה ומדויקת לשיחה כלכלית בעברית. הכותרת צריכה לשקף את התחום המרכזי או מטרת השיחה. אל תספק הסברים, החזר רק את הכותרת, עד 8 מילים.'
      };

      const messages = [systemMessage, ...history];
      const response = await this.model.invoke(messages);
      return response;
    } catch (error) {
      return 'שיחה פיננסית';
    }
  }

  /**
   * זיהוי יועצים רלוונטיים לפי מילות מפתח בהודעת המשתמש
   */
  identifyRelevantAdvisors(message) {
    const activatedAdvisors = [];
    const lowerMessage = message.toLowerCase();
    
    // חיפוש מילות מפתח לכל יועץ
    for (const [advisorId, advisor] of Object.entries(advisorDefinitions)) {
      if (advisor.triggerKeywords && advisor.triggerKeywords.length > 0) {
        for (const keyword of advisor.triggerKeywords) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            activatedAdvisors.push(advisorId);
            break;
          }
        }
      }
    }
    
    // אם לא זוהו יועצים מתאימים, החזרת היועץ הראשי (אופק)
    return activatedAdvisors.length > 0 ? activatedAdvisors : ['strategy'];
  }

  /**
   * בניית הפרומפט המלא עבור היועץ הנוכחי
   */
  buildFullPrompt(advisor, conversation, currentMessage) {
    // פרומפט בסיסי של היועץ
    let prompt = advisor.systemPrompt;
    
    // הוספת מידע על השיחה והקונטקסט
    prompt += '\n\n### מידע על המשתמש והשיחה:';
    
    // הוספת מידע על פרופיל המשתמש
    if (conversation.context.userProfile) {
      prompt += '\n## פרופיל המשתמש:';
      for (const [key, value] of Object.entries(conversation.context.userProfile)) {
        if (value) {
          prompt += `\n- ${key}: ${value}`;
        }
      }
    }
    
    // הוספת מידע פיננסי
    if (conversation.context.financialInfo) {
      prompt += '\n## מידע פיננסי:';
      for (const [key, value] of Object.entries(conversation.context.financialInfo)) {
        if (value) {
          prompt += `\n- ${key}: ${value}`;
        }
      }
    }
    
    // הוספת מטרות
    if (conversation.context.goals && conversation.context.goals.length > 0) {
      prompt += '\n## מטרות פיננסיות:';
      for (const goal of conversation.context.goals) {
        prompt += `\n- ${goal.description} (טווח: ${goal.timeframe}, עדיפות: ${goal.priority})`;
      }
    }
    
    // הוספת דאגות
    if (conversation.context.concerns && conversation.context.concerns.length > 0) {
      prompt += '\n## דאגות פיננסיות:';
      for (const concern of conversation.context.concerns) {
        prompt += `\n- ${concern}`;
      }
    }
    
    // הוספת מידע על מצב השיחה
    prompt += '\n\n### מצב השיחה:';
    prompt += `\n- שלב נוכחי: ${conversation.state.conversationPhase}`;
    prompt += `\n- יועץ נוכחי: ${conversation.state.currentAdvisor}`;
    
    if (conversation.state.previousAdvisors && conversation.state.previousAdvisors.length > 0) {
      prompt += `\n- יועצים קודמים: ${conversation.state.previousAdvisors.join(', ')}`;
    }
    
    if (conversation.state.pendingAdvisors && conversation.state.pendingAdvisors.length > 0) {
      prompt += `\n- יועצים ממתינים: ${conversation.state.pendingAdvisors.join(', ')}`;
    }
    
    // הוספת מידע על ציון מפ"ל
    if (conversation.mfplScores && conversation.mfplScores.current) {
      prompt += '\n\n### ציון מפ"ל 2.0 נוכחי:';
      prompt += `\n- ציון כולל: ${conversation.mfplScores.current.overall}/10`;
      
      if (conversation.mfplScores.current.components) {
        prompt += '\n- ציוני רכיבים:';
        for (const [component, score] of Object.entries(conversation.mfplScores.current.components)) {
          prompt += `\n  * ${component}: ${score}/10`;
        }
      }
    }
    
    // הוספת המלצות קודמות
    if (conversation.recommendations && conversation.recommendations.length > 0) {
      prompt += '\n\n### המלצות שניתנו בשיחה:';
      for (const rec of conversation.recommendations.slice(-5)) { // רק 5 האחרונות
        prompt += `\n- [${rec.advisorId}] ${rec.text} (עדיפות: ${rec.priority}, טווח: ${rec.timeframe})`;
      }
    }
    
    // הוספת הנחיות למבנה התשובה
    prompt += `\n\n### הנחיות לתשובה:
1. ענה למשתמש בצורה טבעית, אישית וידידותית.
2. הימנע מחזרה על מידע שכבר ידוע למשתמש.
3. אסוף מידע חדש ורלוונטי מהמשתמש.
4. זהה טריגרים להפעלת יועצים נוספים.
5. הוסף המלצות ספציפיות כשרלוונטי.
6. עדכן את ציון המפ"ל אם יש מידע חדש שמצדיק זאת.

ההודעה הנוכחית מהמשתמש: "${currentMessage}"
`;
    
    return prompt;
  }

  /**
   * חילוץ ופרסור JSON מתשובת המודל
   */
  extractAndParseResponse(content) {
    // חיפוש JSON בתשובה
    const jsonMatch = content.match(/```json\n([\s\S]*?)```/) || content.match(/({[\s\S]*})/);
    
    if (jsonMatch && jsonMatch[1]) {
      // ניקוי ה-JSON
      const jsonString = jsonMatch[1].trim();
      return JSON.parse(jsonString);
    }
    
    // אם לא נמצא JSON מובנה, ננסה לבנות אותו
    return {
      text: content,
      advisorId: 'strategy', // ברירת מחדל
      processingTime: 0,
      tokens: content.length / 4 // הערכה גסה
    };
  }

  /**
   * התייעצות עם יועץ ספציפי
   */
  async consultSpecificAdvisor(advisorId, question, conversationId, context) {
    try {
      // בדיקה שהיועץ קיים
      if (!advisorDefinitions[advisorId]) {
        throw new Error(`Advisor ${advisorId} not found`);
      }
      
      const advisor = advisorDefinitions[advisorId];
      
      // בניית הפרומפט
      let prompt = advisor.systemPrompt;
      
      // הוספת ההקשר אם קיים
      if (context) {
        prompt += '\n\n### מידע נוסף:';
        for (const [key, value] of Object.entries(context)) {
          if (value) {
            prompt += `\n- ${key}: ${value}`;
          }
        }
      }
      
      // תוספת לפרומפט עבור התייעצות ישירה
      prompt += `\n\n### הנחיות להתייעצות ישירה:
המשתמש פנה אליך ישירות עם השאלה/בקשה. התייחס באופן ממוקד לנושא שבתחום המומחיות שלך.
השאלה: "${question}"`;
      
      // שליחת השאלה למודל
      const response = await this.model.invoke([
        new SystemMessage(prompt),
        new HumanMessage(question)
      ]);
      
      // ניסיון לפרסר תשובה מובנית
      let parsedResponse;
      try {
        parsedResponse = this.extractAndParseResponse(response.content);
      } catch (error) {
        // אם הפרסור נכשל, נשתמש בתשובה כפי שהיא
        parsedResponse = {
          text: response.content,
          advisorId: advisorId,
          recommendations: []
        };
      }
      
      // וידוא שה-advisorId הוא הנכון
      parsedResponse.advisorId = advisorId;
      
      // אם יש שיחה פעילה, נשמור את ההתייעצות בהיסטוריה
      if (conversationId) {
        try {
          const conversation = await require('../models/conversation').findById(conversationId);
          if (conversation) {
            // שמירת ההתייעצות כהערה במידע על השיחה
            if (!conversation.notes) {
              conversation.notes = [];
            }
            
            conversation.notes.push({
              type: 'direct-consultation',
              advisorId: advisorId,
              question: question,
              answer: parsedResponse.text,
              timestamp: new Date()
            });
            
            await conversation.save();
          }
        } catch (error) {
          logger.warn(`Failed to save consultation to conversation history: ${error.message}`);
        }
      }
      
      // החזרת התשובה
      return parsedResponse;
    } catch (error) {
      logger.error(`Error consulting advisor ${advisorId}:`, error);
      return {
        text: `סליחה, נתקלתי בבעיה בהתייעצות עם היועץ ${advisorDefinitions[advisorId]?.name || advisorId}. אנא נסה שוב מאוחר יותר.`,
        advisorId: 'strategy'
      };
    }
  }

   /**
   * קבלת שם היועץ לפי מזהה
   */
   getAdvisorName(advisorId) {
    return advisorDefinitions[advisorId]?.name || advisorId;
  }

  /**
   * קבלת אייקון היועץ לפי מזהה
   */
  getAdvisorIcon(advisorId) {
    return advisorDefinitions[advisorId]?.icon || '/default-advisor.png';
  }
  
  /**
   * יצירת דו"ח מסכם על השיחה
   */
  async generateConversationSummary(conversation) {
    try {
      // בניית פרומפט לסיכום
      const prompt = `
אתה אופק, מנהל היועצים הפיננסיים במערכת "אופק פיננסי 360°".
תפקידך כעת הוא לייצר דו"ח מסכם מקיף על השיחה עם הלקוח.

### נתוני השיחה:
- מספר הודעות: ${conversation.messages.length}
- תחילת השיחה: ${new Date(conversation.startedAt).toLocaleString('he-IL')}
- פעילות אחרונה: ${new Date(conversation.lastActivity).toLocaleString('he-IL')}
- שלב השיחה: ${conversation.state.conversationPhase}

### מידע שנאסף על הלקוח:
${JSON.stringify(conversation.context, null, 2)}

### המלצות שניתנו:
${conversation.recommendations.map(rec => `- [${rec.priority}] ${rec.text} (${rec.advisorId})`).join('\n')}

### ציוני מפ"ל:
- ציון התחלתי: ${conversation.mfplScores.initial.overall || 'לא ידוע'}
- ציון נוכחי: ${conversation.mfplScores.current.overall || 'לא ידוע'}

יצירת דו"ח מסכם מובנה ויזואלי שכולל:
1. סיכום כללי של השיחה והמצב הפיננסי של הלקוח
2. חוזקות פיננסיות עיקריות שזוהו
3. אתגרים ונקודות לשיפור
4. המלצות עיקריות לפי סדר עדיפות
5. צעדים מומלצים להמשך

הדו"ח צריך להיות בפורמט מובנה, בהיר וקצר, ללא חזרות מיותרות.
השתמש באייקונים ובמובנה ויזואלי כמתואר במסמך ההנחיות.`;
      
      // שליחת הבקשה למודל
      const response = await this.model.invoke([
        new SystemMessage(prompt)
      ]);
      
      return response.content;
    } catch (error) {
      logger.error('Error generating conversation summary:', error);
      return "סליחה, נתקלתי בבעיה ביצירת דו\"ח מסכם. אנא נסה שוב מאוחר יותר.";
    }
  }

  /**
   * יצירת תכנית פעולה
   */
  async generateActionPlan(conversation) {
    try {
      // בניית פרומפט לתכנית פעולה
      const prompt = `
אתה אופק, מנהל היועצים הפיננסיים במערכת "אופק פיננסי 360°".
תפקידך כעת הוא לייצר תכנית פעולה מעשית ומפורטת עבור הלקוח בהתבסס על השיחה והמלצות היועצים.

### מידע שנאסף על הלקוח:
${JSON.stringify(conversation.context, null, 2)}

### המלצות שניתנו:
${conversation.recommendations.map(rec => `- [${rec.priority}] ${rec.text} (${rec.advisorId})`).join('\n')}

### ציוני מפ"ל:
- ציון נוכחי: ${conversation.mfplScores.current.overall || 'לא ידוע'}
- פירוט רכיבים: ${JSON.stringify(conversation.mfplScores.current.components || {}, null, 2)}

יצירת תכנית פעולה מפורטת שכוללת:
1. צעדים מיידיים (0-30 יום)
2. צעדים לטווח קצר (1-3 חודשים)
3. צעדים לטווח בינוני (3-12 חודשים)
4. צעדים לטווח ארוך (שנה ומעלה)

לכל צעד יש לציין:
- תיאור מפורט של הפעולה
- היועץ שהמליץ עליה
- דד-ליין מומלץ לביצוע
- רמת עדיפות (קריטי, גבוה, בינוני, נמוך)

השתמש במבנה הבא:

📋 תכנית פעולה פיננסית:
📅 מיידי (עד חודש):
  [⭐] משימה בעדיפות גבוהה
  [ ] משימה רגילה

📅 טווח קצר (1-6 חודשים):
  [ ] משימה עתידית

התכנית צריכה להיות מפורטת, ישימה ומתועדפת נכון.`;
      
      // שליחת הבקשה למודל
      const response = await this.model.invoke([
        new SystemMessage(prompt)
      ]);
      
      // ניסיון לחלץ תכנית פעולה מובנית
      // בעתיד אפשר לשפר ולפרסר את התשובה למבנה מובנה יותר
      return {
        content: response.content,
        steps: this.extractActionSteps(response.content)
      };
    } catch (error) {
      logger.error('Error generating action plan:', error);
      return {
        content: "סליחה, נתקלתי בבעיה ביצירת תכנית פעולה. אנא נסה שוב מאוחר יותר.",
        steps: []
      };
    }
  }

  /**
   * חילוץ צעדי פעולה מפורטים מתוך טקסט התכנית
   */
  extractActionSteps(content) {
    const steps = [];
    const lines = content.split('\n');
    
    let currentTimeframe = '';
    const timeframePatterns = {
      'מיידי': 'immediate',
      'טווח קצר': 'short-term',
      'טווח בינוני': 'medium-term',
      'טווח ארוך': 'long-term'
    };
    
    const priorityPatterns = {
      'קריטי': 'critical',
      'גבוה': 'high',
      'בינוני': 'medium',
      'נמוך': 'low'
    };
    
    // חיפוש כותרות של טווחי זמן
    for (const line of lines) {
      // חיפוש כותרת של טווח זמן
      for (const [hebrewPattern, englishValue] of Object.entries(timeframePatterns)) {
        if (line.includes(hebrewPattern)) {
          currentTimeframe = englishValue;
          break;
        }
      }
      
      // חיפוש צעד פעולה (מתחיל עם סימון כלשהו של רשימה)
      if (line.match(/^[\s-]*[0-9. \-*\[\]⭐✓]+/) && line.length > 5) {
        const step = {
          description: line.replace(/^[\s-]*[0-9. \-*\[\]⭐✓]+/, '').trim(),
          timeframe: currentTimeframe || 'medium-term',
          priority: line.includes('⭐') ? 'high' : 'medium',
          advisorId: 'strategy', // ברירת מחדל
          deadline: this.calculateDeadline(currentTimeframe),
          completed: line.includes('✓') || line.includes('[✓]')
        };
        
        // חיפוש עדיפות
        for (const [hebrewPattern, englishValue] of Object.entries(priorityPatterns)) {
          if (line.toLowerCase().includes(hebrewPattern)) {
            step.priority = englishValue;
            break;
          }
        }
        
        // חיפוש שם יועץ
        for (const [advisorId, advisor] of Object.entries(advisorDefinitions)) {
          if (line.includes(advisor.name)) {
            step.advisorId = advisorId;
            break;
          }
        }
        
        steps.push(step);
      }
    }
    
    return steps;
  }

  /**
   * חישוב תאריך יעד בהתבסס על טווח זמן
   */
  calculateDeadline(timeframe) {
    const now = new Date();
    
    switch (timeframe) {
      case 'immediate':
        now.setDate(now.getDate() + 30); // 30 יום
        break;
      case 'short-term':
        now.setMonth(now.getMonth() + 3); // 3 חודשים
        break;
      case 'medium-term':
        now.setMonth(now.getMonth() + 12); // שנה
        break;
      case 'long-term':
        now.setFullYear(now.getFullYear() + 2); // שנתיים
        break;
      default:
        now.setMonth(now.getMonth() + 6); // 6 חודשים כברירת מחדל
    }
    
    return now;
  }

  /**
   * הפעלת יכולת "העצמי העתידי"
   */
  async activateFutureSelf(conversation, age, context) {
    try {
      // עדכון מצב השיחה
      conversation.state.specialMode = 'future-self';
      conversation.state.futureSelfContext = {
        ageInFuture: age || 70,
        context: context || ""
      };
      
      // שמירת השיחה
      await conversation.save();
      
      // יצירת הודעת יועץ מיוחדת שמודיעה על המעבר ל"עצמי העתידי"
      const activationMessage = new (require('../models/message'))({
        conversationId: conversation._id,
        text: `עוברים למצב "העצמי העתידי" בגיל ${age || 70}. כעת תוכל לשוחח עם העצמי העתידי שלך ולקבל פרספקטיבה על ההחלטות הפיננסיות שלך בהווה.`,
        sender: 'system',
        advisorId: 'strategy',
        metadata: {
          specialMode: 'future-self',
          futureSelfActivation: {
            activated: true,
            ageInFuture: age || 70,
            context: context || ""
          }
        }
      });
      
      await activationMessage.save();
      
      // הוספת ההודעה לשיחה
      conversation.messages.push(activationMessage._id);
      await conversation.save();
      
      return {
        success: true,
        message: activationMessage
      };
    } catch (error) {
      logger.error('Error activating future self:', error);
      return {
        success: false,
        error: 'Failed to activate future self mode'
      };
    }
  }
  
  /**
   * ביטול מצב "העצמי העתידי" וחזרה למצב רגיל
   */
  async deactivateFutureSelf(conversation) {
    try {
      // בדיקה שאכן במצב "העצמי העתידי"
      if (conversation.state.specialMode !== 'future-self') {
        return {
          success: false,
          error: 'Not in future self mode'
        };
      }
      
      // חזרה למצב רגיל
      conversation.state.specialMode = null;
      conversation.state.futureSelfContext = null;
      
      // חזרה ליועץ הראשי
      conversation.state.currentAdvisor = 'strategy';
      
      // שמירת השיחה
      await conversation.save();
      
      // יצירת הודעת יועץ מיוחדת שמודיעה על החזרה למצב רגיל
      const deactivationMessage = new (require('../models/message'))({
        conversationId: conversation._id,
        text: `חזרנו למצב רגיל. אופק, מנהל היועצים, ימשיך לסייע לך מכאן.`,
        sender: 'system',
        advisorId: 'strategy'
      });
      
      await deactivationMessage.save();
      
      // הוספת ההודעה לשיחה
      conversation.messages.push(deactivationMessage._id);
      await conversation.save();
      
      return {
        success: true,
        message: deactivationMessage
      };
    } catch (error) {
      logger.error('Error deactivating future self:', error);
      return {
        success: false,
        error: 'Failed to deactivate future self mode'
      };
    }
  }

}

module.exports = new OrchestratorService();