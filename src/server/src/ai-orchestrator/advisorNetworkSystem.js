const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage, AIMessage, BaseMessage } = require('@langchain/core/messages');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../../configs/config');
const { handleMessage } = require('../ai-orchestrator/orchestratorService');
const ChatPromptBuilder = require('../ai-orchestrator/chatPromptBuilder');
const AdvisorEngine = require('../utils/advisorEngine');
const { toLangchainMessages } = require('../utils/messageUtils');
const { JsonOutputFunctionsParser } = require("langchain/output_parsers");
const {
    recordAdvisorSummary,
    handleAdvisorResponse
} = require('../utils//advisorSummaryTools');
const { maybeTriggerFutureSelf } = require('./../utils/futureSelfTrigger');
const { renderMapalMarkdown, VALID_MAPAL_FIELDS, calculateWeightedMapalReadiness } = require('./../utils/mapalEnginePro');
const { injectEmotionalQuestion } = require('./../utils/emutionalEngine');

// Impact levels for MAPAL scoring
const IMPACT_LEVELS = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  QUANTUM: 5
};

// הגדרת פונקציה (function definition) בפורמט JSON Schema
const functionDefinition = {
    name: "advisor_response",
    description: "פורמט התשובה המובנה של היועץ הפיננסי",
    parameters: {
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "תוכן התשובה בפורמט Markdown"
            },
            advisorId: {
                type: "string",
                enum: [
                    "strategy",
                    "budget",
                    "mortgage",
                    "investments",
                    "pension",
                    "risk",
                    "behavior",
                    "selfemployed",
                    "special",
                    "data",
                    "career",
                    "meaning",
                    "abundance",
                    "young",
                    "altinvest",
                    "intergen",
                    "altretire",
                    "futureself"
                ],
                description: "מזהה היועץ הנוכחי"
            },
            handoffSummary: {
                type: "string",
                description: "סיכום ממצאים מהותיים להעברה ליועץ הבא (רק אם יש nextAdvisor)"
            },
            mapalUpdates: {
                type: "array",
                description: "עדכוני מפ\"ל — רשימת תחומים שנגעת בהם בשיחה זו. כלול רק תחומים שבאמת עסקת בהם.",
                items: {
                    type: "object",
                    properties: {
                        field: {
                            type: "string",
                            enum: [
                                "financialFoundations",
                                "behaviorAndHabits",
                                "pensionPlanning",
                                "assetDiversification",
                                "alternativeInvestments",
                                "mortgageOptimization",
                                "legalAndInsurance",
                                "incomeGrowth",
                                "specialSituationsResilience",
                                "dataBasedManagement",
                                "resourceLifeQualityBalance",
                                "abundanceMindset",
                                "intergenerationalTransfer",
                                "retirementAlternatives"
                            ],
                            description: "שם התחום"
                        },
                        impact: {
                            type: "string",
                            enum: ["LOW", "MEDIUM", "HIGH", "QUANTUM"],
                            description: "עוצמת ההשפעה: LOW=1, MEDIUM=2, HIGH=3, QUANTUM=5"
                        }
                    },
                    required: ["field", "impact"]
                }
            },
            nextAdvisor: {
                type: "object",
                properties: {
                    advisorId: {
                        type: "string",
                        enum: [
                            "strategy",
                            "budget",
                            "mortgage",
                            "investments",
                            "pension",
                            "risk",
                            "behavior",
                            "selfemployed",
                            "special",
                            "data",
                            "career",
                            "meaning",
                            "abundance",
                            "young",
                            "altinvest",
                            "intergen",
                            "altretire",
                            "futureself"
                        ],
                        description: "מזהה היועץ להעברה אם נדרש באנגלית בלבד"
                    },
                    reason: {
                        type: "string",
                        description: "סיבת המעבר"
                    },
                    handoffText: {
                        type: "string",
                        description: "טקסט המעבר למשתמש"
                    }
                },
                required: ["advisorId", "reason", "handoffText"]
            }
        },
        required: ["text", "advisorId", "mapalUpdates"]
    }
};

class AdvisorNetworkSystem {
    constructor() {
        // יצירת מודל הבסיס
        this.model = new ChatOpenAI({
            openAIApiKey: config.openai.apiKey,
            modelName: config.openai.modelName,
            temperature: 0.6, // מוריד טמפרטורה לעקביות
            verbose: false,//config.langchain.verbose,
            functions: [functionDefinition],
            function_call: { name: "advisor_response" } // ✅ הכי חשוב - מחייב את המודל להחזיר את הפונקציה הזאת בלבד
        });

        //console.error('Model:', this.model);

        // טעינת קובץ ההגדרות המלא
        const promptPath = path.join(__dirname, '..', '..', 'configs', 'advisors-network-definition.md');
        this.systemPrompt = fs.readFileSync(promptPath, 'utf8');

        // טעינת הגדרות היועצים
        try {
            const advisorDefsPath = path.join(__dirname, '..', 'advisors', 'advisorDefinitions.js');
            this.advisorDefinitions = require(advisorDefsPath);
        } catch (error) {
            logger.error('Failed to load advisor definitions:', error);
            // יצירת אובייקט ברירת מחדל במקרה של שגיאה
            this.advisorDefinitions = {};
        }

        // מפת זיכרון לשיחות
        this.conversationHistories = new Map();

        //this.initializeConversation(); 
    }

    // NOTE: History is now fetched from DB per message, not stored in memory

    // הוסף את הפונקציה הזו לקלאס AdvisorNetworkSystem
    /**
     * אתחול שיחה חדשה עם העברת כל ההנחיות פעם אחת
     */
    async initializeConversation(conversationId, userProfile) {
        try {
            const initialAdvisor = AdvisorEngine.getAdvisorById('strategy');
            const session = ChatPromptBuilder.initSession(initialAdvisor); // מחזיר שני שדות: systemMessages + userIntroMessage

            return {
                advisor: initialAdvisor.advisorId,
                messages: session.systemMessages, // מה שישלח ל-GPT
                userIntroMessage: session.userIntroMessage, // מה שמוצג למשתמש
                stage: session.stage
            };
        } catch (error) {
            logger.error('Failed to initialize conversation', error);
            return {
                initialized: false,
                advisorId: 'strategy'
            };
        }
    }


    // פונקציית עזר להמרת שם יועץ בעברית למזהה
    mapHebrewToAdvisorId(hebrewName) {
        const mapping = {
            'אופק': 'strategy',
            'רון': 'budget',
            'גיא': 'mortgage',
            'דנה': 'investments',
            'יעל': 'pension',
            'ענת': 'risk',
            'ליאור': 'behavior',
            'עידו': 'selfemployed',
            'אלינור': 'special',
            'תום': 'data',
            'נועם': 'career',
            'אמיר': 'meaning',
            'הדס': 'abundance',
            'טל': 'young',
            'יואב': 'altinvest',
            'מיכל': 'intergen',
            'נועה': 'altretire'
        };

        return mapping[hebrewName] || 'strategy';
    }


    async generateTitle(message, conversation, forcedAdvisorId = null) {
        try {
            const systemMessage = {
                role: 'system',
                content: 'צור כותרת קצרה ומדויקת לשיחה כלכלית בעברית. הכותרת צריכה לשקף את התחום המרכזי או מטרת השיחה. אל תספק הסברים, החזר רק את הכותרת, עד 8 מילים.'
            };

            const history = Array.isArray(conversation.history)
                ? conversation.history.slice(-5).map(m => ({ role: m.role, content: m.content }))
                : [];

            const messages = [systemMessage, ...history, { role: 'user', content: message }];
            const response = await this.model.invoke(messages);
            return response;
        } catch (error) {
            logger.error('Error in advisorNetworkSystem.processMessage:', error);
            return {
                text: "סליחה, נתקלתי בבעיה בעיבוד השאלה שלך. אנא נסה שוב או נסח את השאלה אחרת.",
                advisorId: conversation.state.currentAdvisor || 'strategy',
                processingTime: 0,
                model: config.openai.modelName,
                temperature: 0.6
            };
        }
    }

    handleHandoffConfirmationIfNeeded(conversation, currentAdvisorId) {
        const handoffState = conversation.state.awaitingHandoffConfirmation;

        if (!handoffState || handoffState.advisorId !== currentAdvisorId) {
            return null;
        }

        return {
            text: `🧭 ${handoffState.reason || 'נראה שסיימנו שלב חשוב בשיחה.'}
      
      האם זה נשמע לך מתאים להמשיך עכשיו ליועץ הבא בתחום **${handoffState.suggestedNext}**?
      
      - כתוב "כן" כדי שנעבור הלאה
      - או שתכתוב אם תרצה להמשיך איתי לעוד שאלה אחת 🙂`,
            advisorId: currentAdvisorId,
            nextAdvisor: handoffState.suggestedNext
        };
    }


    /**
     * עיבוד הודעה מהמשתמש וקבלת תשובה - גרסה משופרת עם קריאת LLM יחידה
     */
    async processMessage(conversation, messages, message) {
        const startTime = Date.now();

        // 1. הכנת state
        conversation.state = conversation.state || {};
        conversation.state.mapalScore = conversation.state.mapalScore || {};
        conversation.history = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
            advisorId: msg.advisorId,
            metadata: msg.metadata
        }));

        const currentAdvisorId = conversation.state.currentAdvisor || 'strategy';
        const advisor = AdvisorEngine.getAdvisorById(currentAdvisorId);

        if (!advisor) {
            logger.error(`Advisor not found: ${currentAdvisorId}`);
            return {
                text: 'שגיאה: לא נמצא יועץ מתאים',
                advisorId: 'strategy'
            };
        }

        // 2. בניית system prompt עם context מהיועץ הקודם
        let systemPrompt = advisor.systemPrompt;

        // הזרקת סיכום מהיועץ הקודם (אם קיים)
        if (conversation.state.lastAdvisorSummary) {
            const prevAdvisor = AdvisorEngine.getAdvisorById(conversation.state.lastAdvisorSummary.advisorId);
            const prevName = prevAdvisor?.name || conversation.state.lastAdvisorSummary.advisorName || 'יועץ קודם';
            systemPrompt += `\n\n---\n🔁 מידע חשוב מהיועץ הקודם (${prevName}):\n${conversation.state.lastAdvisorSummary.summary}`;
        }

        // הוראות handoff + MAPAL
        const advisorName = advisor.name || currentAdvisorId;
        const handoffInstructions = `
🔧 פורמט התשובה (חובה):
- text: התשובה המלאה בMarkdown
- advisorId: "${currentAdvisorId}"
- mapalUpdates: רשימת התחומים שנגעת בהם בשיחה זו (ראה למטה)

📊 **מפ"ל 3.0 — עדכון תחומים:**
עדכן כל תחום שבאמת עסקת בו בהודעה זו (ניתן לעדכן מספר תחומים בבת אחת!):
- financialFoundations — יסודות, תקציב, תזרים חודשי
- behaviorAndHabits — הרגלים, דפוסי הוצאה, פסיכולוגיה כלכלית
- pensionPlanning — פנסיה, קרן השתלמות, פרישה
- assetDiversification — השקעות, חיסכון לטווח ארוך, תיק נכסים
- alternativeInvestments — קריפטו, השקעות חדשניות, סטארטאפים
- mortgageOptimization — משכנתא, נדל"ן, מיחזור הלוואה
- legalAndInsurance — ביטוחים, ניהול סיכונים, עצמאים
- incomeGrowth — קריירה, העלאת הכנסות, מיתוג אישי
- specialSituationsResilience — גירושין, מוות, משבר, מצב מורכב
- dataBasedManagement — ניתוח נתונים, מעקב, דוחות
- resourceLifeQualityBalance — איזון חיים-כסף, מטרות חיים
- abundanceMindset — תודעת שפע, אמונות מגבילות, חסמים נפשיים
- intergenerationalTransfer — ירושה, עסק משפחתי, העברת נכסים
- retirementAlternatives — פרישה מוקדמת, FIRE, חופשה שבתית

דוגמה: [{"field": "financialFoundations", "impact": "HIGH"}, {"field": "behaviorAndHabits", "impact": "MEDIUM"}]
אם השיחה לא נגעה באף תחום: []

🎯 **מי אתה:**
- אתה ${advisorName}, והמזהה שלך הוא "${currentAdvisorId}"
- אתה כבר היועץ הפעיל בשיחה! המשתמש כבר הועבר אליך.
- **אל תגיד "אני מעביר אותך ליועץ השקעות/תקציב/משכנתא" אם אתה כבר היועץ של אותו תחום!**
- אם המשתמש ביקש להגיע אליך - הוא כבר אצלך! תתחיל לעבוד איתו ישירות, שאל שאלות רלוונטיות מתחום המומחיות שלך.

⚠️ **מעבר בין יועצים (רק כשצריך):**
- העבר ליועץ אחר **רק** אם המשתמש שואל על נושא שלא בתחום המומחיות שלך
- אם אתה כותב בtext "אני מעביר/ה אותך ל..." - אתה **חייב** להחזיר גם nextAdvisor + handoffSummary!
- **אין להזכיר מעבר ליועץ אחר בtext אלא אם כן אתה באמת מחזיר nextAdvisor!**

פורמט nextAdvisor (רק כשיש מעבר ליועץ אחר):
{
  "nextAdvisor": {
    "advisorId": "מזהה היועץ באנגלית (investments/budget/mortgage/pension וכו')",
    "reason": "למה המעבר הזה נחוץ",
    "handoffText": "הטקסט על המעבר"
  },
  "handoffSummary": "סיכום 2-3 משפטים על המשתמש"
}
        `;

        // 3. בניית messages array
        const historyContext = conversation.history.slice(-10); // 10 הודעות אחרונות
        const cleanMessages = toLangchainMessages([
            { role: 'system', content: `${systemPrompt}\n\n${handoffInstructions}` },
            ...historyContext.map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
        ]);

        // 4. קריאת LLM יחידה! (במקום 3)
        const parser = new JsonOutputFunctionsParser();
        let aiResponse;
        try {
            aiResponse = await this.model.invoke(cleanMessages, {
                functions: [functionDefinition],
                function_call: { name: "advisor_response" }
            });
        } catch (err) {
            logger.error('LLM invocation error:', err);
            return {
                text: 'מצטער, נתקלתי בבעיה טכנית. אנא נסה שוב.',
                advisorId: currentAdvisorId
            };
        }

        // 5. פענוח התשובה
        let parsedResponse;
        try {
            parsedResponse = this.extractAndParseResponse(aiResponse);
            parsedResponse.advisorId = parsedResponse.advisorId || currentAdvisorId;

            // Validation: בדוק אי-התאמה בין text ל-nextAdvisor
            const handoffKeywords = ['אעביר', 'נעביר', 'אעבירה', 'נעבירה', 'מעבירה', 'מעביר', 'נתקדם ל', 'בואו נעבור'];
            const mentionsHandoff = handoffKeywords.some(keyword => parsedResponse.text?.includes(keyword));

            if (mentionsHandoff && !parsedResponse.nextAdvisor) {
                logger.warn(`⚠️  Advisor ${currentAdvisorId} mentions handoff in text but didn't return nextAdvisor!`, {
                    advisorId: currentAdvisorId,
                    textSnippet: parsedResponse.text?.substring(0, 200)
                });
            }

            // 6. שמירת handoff summary אם יש
            if (parsedResponse.nextAdvisor && parsedResponse.handoffSummary) {
                conversation.state.lastAdvisorSummary = {
                    advisorId: currentAdvisorId,
                    advisorName: advisor.name,
                    summary: parsedResponse.handoffSummary
                };
            }

            // 7. עדכון MAPAL 3.0 — ריבוי שדות בקריאה אחת
            if (Array.isArray(parsedResponse.mapalUpdates) && parsedResponse.mapalUpdates.length > 0) {
                for (const update of parsedResponse.mapalUpdates) {
                    const { field, impact } = update;
                    const impactValue = IMPACT_LEVELS[impact] || 0;
                    if (impactValue > 0 && VALID_MAPAL_FIELDS.includes(field)) {
                        const prev = conversation.state.mapalScore[field] || 0;
                        const next = Math.min(prev + impactValue, 5);
                        conversation.state.mapalScore[field] = next;
                        this.addMapalHistoryEntry(
                            conversation,
                            field,
                            prev,
                            next,
                            currentAdvisorId,
                            parsedResponse.text,
                            impact
                        );
                    }
                }
                conversation.state.mapalScore.readiness = calculateWeightedMapalReadiness(conversation.state.mapalScore).percent;
            }

            // 8. הזרקת שאלה רגשית
            injectEmotionalQuestion(conversation, currentAdvisorId, parsedResponse);

            // 9. רינדור MAPAL markdown
            const fieldKey = MAPAL_FIELD_KEYS[currentAdvisorId];
            if (fieldKey) {
                const markdown = renderMapalMarkdown(conversation.state.mapalScore);
                if (markdown) {
                    parsedResponse.text += `\n\n${markdown}`;
                }
            }

            // 10. עדכון current advisor + קריאה ליועץ החדש אם יש handoff
            if (parsedResponse.nextAdvisor?.advisorId && parsedResponse.nextAdvisor.advisorId !== currentAdvisorId) {
                const newAdvisorId = parsedResponse.nextAdvisor.advisorId;
                conversation.state.currentAdvisor = newAdvisorId;

                // קריאת LLM נוספת מהיועץ החדש כדי שיענה ישירות
                try {
                    const newAdvisor = AdvisorEngine.getAdvisorById(newAdvisorId);
                    if (newAdvisor) {
                        let newSystemPrompt = newAdvisor.systemPrompt;

                        // הזרקת סיכום מהיועץ הקודם
                        if (conversation.state.lastAdvisorSummary) {
                            newSystemPrompt += `\n\n---\n🔁 מידע חשוב מהיועץ הקודם (${advisor.name}):\n${conversation.state.lastAdvisorSummary.summary}`;
                        }

                        const newAdvisorName = newAdvisor.name || newAdvisorId;
                        const newHandoffInstructions = `
🔧 פורמט התשובה (חובה):
- text: התשובה המלאה בMarkdown
- advisorId: "${newAdvisorId}"
- mapalImpact: הערך את עוצמת ההשפעה (NONE/LOW/MEDIUM/HIGH/QUANTUM)

🎯 **מי אתה:**
- אתה ${newAdvisorName}, והמזהה שלך הוא "${newAdvisorId}"
- המשתמש **הועבר אליך עכשיו** מיועץ אחר. הצג את עצמך בקצרה והתחל לעבוד ישירות!
- שאל שאלות רלוונטיות מתחום המומחיות שלך כדי להתחיל לעזור.
`;

                        const newMessages = toLangchainMessages([
                            { role: 'system', content: `${newSystemPrompt}\n\n${newHandoffInstructions}` },
                            ...historyContext.map(h => ({ role: h.role, content: h.content })),
                            { role: 'user', content: message }
                        ]);

                        const newAiResponse = await this.model.invoke(newMessages, {
                            functions: [functionDefinition],
                            function_call: { name: "advisor_response" }
                        });

                        const newParsedResponse = this.extractAndParseResponse(newAiResponse);
                        newParsedResponse.advisorId = newAdvisorId;

                        // MAPAL 3.0 עדכון מהיועץ החדש — ריבוי שדות
                        if (Array.isArray(newParsedResponse.mapalUpdates) && newParsedResponse.mapalUpdates.length > 0) {
                            for (const update of newParsedResponse.mapalUpdates) {
                                const { field, impact } = update;
                                const impactValue = IMPACT_LEVELS[impact] || 0;
                                if (impactValue > 0 && VALID_MAPAL_FIELDS.includes(field)) {
                                    const prev = conversation.state.mapalScore[field] || 0;
                                    const next = Math.min(prev + impactValue, 5);
                                    conversation.state.mapalScore[field] = next;
                                }
                            }
                            conversation.state.mapalScore.readiness = calculateWeightedMapalReadiness(conversation.state.mapalScore).percent;
                        }

                        // שאלה רגשית + MAPAL markdown
                        injectEmotionalQuestion(conversation, newAdvisorId, newParsedResponse);
                        const newFieldKey = MAPAL_FIELD_KEYS[newAdvisorId];
                        if (newFieldKey) {
                            const markdown = renderMapalMarkdown(conversation.state.mapalScore);
                            if (markdown) {
                                newParsedResponse.text += `\n\n${markdown}`;
                            }
                        }

                        newParsedResponse.processingTime = (Date.now() - startTime) / 1000;
                        newParsedResponse.model = config.openai.modelName;
                        newParsedResponse.temperature = 0.6;

                        logger.info(`✅ Handoff complete: ${currentAdvisorId} → ${newAdvisorId}`);
                        return newParsedResponse;
                    }
                } catch (handoffErr) {
                    logger.error('Error during handoff LLM call, returning original response:', handoffErr);
                    // fallback - החזר את התשובה המקורית
                }
            } else {
                conversation.state.currentAdvisor = parsedResponse.advisorId;
            }

            // 11. metadata
            parsedResponse.processingTime = (Date.now() - startTime) / 1000;
            parsedResponse.model = config.openai.modelName;
            parsedResponse.temperature = 0.6;

            return parsedResponse;

        } catch (err) {
            logger.error('Parsing Error:', err);
            return {
                text: aiResponse?.content || 'שגיאה בפענוח התשובה.',
                advisorId: currentAdvisorId
            };
        }
    }

    addMapalHistoryEntry(conversation, domain, from, to, advisorId, excerpt, method) {
        const safeFrom = Number.isFinite(from) ? Number(from) : 0;
        const safeTo = Number.isFinite(to) ? Number(to) : 0;

        const entry = {
            timestamp: new Date().toISOString(),
            domain,
            from: safeFrom,
            to: safeTo,
            method,
            source: advisorId,
            excerpt: excerpt?.slice(0, 300) || ''
        };

        conversation.state.mapalHistory = conversation.state.mapalHistory || [];
        conversation.state.mapalHistory.push(entry);
    }


    shouldFallbackUpdate(text) {
        if (!text || typeof text !== 'string') return false;

        const blacklist = [
            'תודה',
            'בהצלחה',
            'מקווה שעזרתי',
            'שיהיה בהצלחה',
            'נשמע טוב',
            'מובן',
            'בהצלחה בדרך',
            'נשמח להמשיך לעזור'
        ];

        const normalized = text.toLowerCase();
        return !blacklist.some(phrase => normalized.includes(phrase));
    }


    shouldGreetUserAgain(conversation, advisorId) {
        const lastMessages = [...conversation.history].reverse();

        for (const msg of lastMessages) {
            if (msg.role === 'system' && msg.advisorId === advisorId) {
                // מצאנו את ההודעה האחרונה של היועץ הנוכחי
                return false; // כבר בירך
            }
        }
        return true;
    }


    /**
     * סיכום היסטוריית שיחה כדי להפחית את כמות הטוקנים הנדרשת
     */
    /**
     * מסכם את היסטוריית השיחה (לשימוש עתידי)
     * @returns {string|null} - הסיכום או null אם אין מספיק היסטוריה
     */
    async summarizeConversationHistory(conversation, model) {
        try {
            const history = conversation.history;
            if (!history || history.length < 10) return null;

            const summarizationPrompt = `
סכם את השיחה הבאה בתמציתיות, תוך שמירה על:
1. הנקודות החשובות ביותר שעלו בשיחה
2. מידע פיננסי רלוונטי שהוזכר
3. צרכים ורצונות שהלקוח הביע
4. החלטות או המלצות שניתנו

הסיכום צריך להיות קצר וענייני (2-3 פסקאות), ולאפשר המשך שיחה יעיל.
        `.trim();

            const historyToSummarize = history.slice(0, -8);

            const messages = [
                new SystemMessage(summarizationPrompt),
                ...historyToSummarize
            ];

            const cleanMessages = toLangchainMessages(messages);

            const response = await model.invoke(cleanMessages);

            logger.debug(`Conversation ${conversation.id} history summarized`);
            return response.content;
        } catch (error) {
            logger.error('Error summarizing conversation history', error);
            return null;
        }
    }


    formatResponseText(text) {
        // אם כבר יש תגי HTML, לא לשנות
        if (text.includes('<div') || text.includes('<p') || text.includes('<br')) {
            return text;
        }

        // המרת שורות חדשות לתגי HTML
        text = text.replace(/\n/g, '<br>');

        // פיצול לפסקאות (אופציונלי)
        text = text.replace(/<br><br>/g, '</p><p>');

        // עטיפה בתגי פסקה
        return `<p>${text}</p>`;
    }

    /**
     * חילוץ ופרסור JSON מתשובת המודל
     */
    extractAndParseResponse(message) {
        if (message?.additional_kwargs?.function_call?.arguments) {
            try {
                return JSON.parse(message.additional_kwargs.function_call.arguments);
            } catch (err) {
                console.error("Failed to parse function_call arguments", err);
            }
        }

        return {
            text: message.content || "",
            advisorId: 'strategy',
            processingTime: 0,
            tokens: (message.content || "").length / 4
        };
    }



    /**
    * קבלת מגדר היועץ לפי מזהה
    */
    getAdvisorGender(advisorId) {
        const advisorGenders = {
            'strategy': 'male',    // אופק
            'budget': 'male',      // רון
            'mortgage': 'male',    // גיא
            'investments': 'female', // דנה
            'pension': 'female',     // יעל
            'risk': 'female',      // ענת
            'behavior': 'male',    // ליאור
            'selfemployed': 'male', // עידו
            'special': 'female',   // אלינור
            'data': 'male',        // תום
            'career': 'male',      // נועם
            'meaning': 'male',     // אמיר
            'abundance': 'female', // הדס
            'young': 'female',     // טל
            'altinvest': 'male',   // יואב
            'intergen': 'female',  // מיכל
            'altretire': 'female'  // נועה
        };

        return advisorGenders[advisorId] || 'male'; // ברירת מחדל: זכר
    }
    /**
     * קבלת שם היועץ לפי מזהה
     */
    getAdvisorName(advisorId) {
        const advisorNames = {
            'strategy': 'אופק – מנהל יועצים פיננסיים',
            'budget': 'רון – כלכלת המשפחה',
            'mortgage': 'גיא – משכנתאות ונדל"ן',
            'investments': 'דנה – השקעות וחסכונות',
            'pension': 'יעל – פרישה ופנסיה',
            'risk': 'ענת – ביטוחים והגנות',
            'behavior': 'ליאור – כלכלה התנהגותית',
            'selfemployed': 'עידו – עצמאים ועסקים קטנים',
            'special': 'אלינור – מצבים מיוחדים',
            'data': 'תום – ניתוח נתונים פיננסיים',
            'career': 'נועם – קריירה וצמיחה פיננסית',
            'meaning': 'אמיר – איכות חיים ושפע',
            'abundance': 'הדס – תודעת שפע',
            'young': 'טל – צעירים ודור Z',
            'altinvest': 'יואב – השקעות אלטרנטיביות',
            'intergen': 'מיכל – העברה בין-דורית',
            'altretire': 'נועה – פרישה אלטרנטיבית',
            'futureself': 'העצמי העתידי'
        };

        return advisorNames[advisorId] || advisorId;
    }

    /**
     * קבלת אייקון היועץ לפי מזהה
     */
    getAdvisorIcon(advisorId) {
        const advisorIcons = {
            'strategy': '/strategy.png',
            'budget': '/budget.png',
            'mortgage': '/mortgage.png',
            'investments': '/investments.png',
            'pension': '/pension.png',
            'risk': '/risk.png',
            'behavior': '/behavior.png',
            'selfemployed': '/selfemployed.png',
            'special': '/special.png',
            'data': '/data.png',
            'career': '/career.png',
            'meaning': '/meaning.png',
            'abundance': '/abundance.png',
            'young': '/young.png',
            'altinvest': '/altinvest.png',
            'intergen': '/intergen.png',
            'altretire': '/altretire.png',
            'futureself': '/futureself.png'
        };

        return advisorIcons[advisorId] || '/default-advisor.png';
    }
}

module.exports = new AdvisorNetworkSystem();