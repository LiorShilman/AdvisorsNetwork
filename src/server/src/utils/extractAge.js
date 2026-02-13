const { toLangchainMessages } = require('../utils/messageUtils'); // ודא שהנתיב נכון

async function extractIdentitySmart(history, model) {
  if (!model || typeof model.invoke !== 'function') {
    throw new Error('Model instance with .invoke function is required');
  }

  const userMessages = history
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => `${msg.role === 'user' ? 'משתמש' : 'יועץ'}: ${msg.content}`)
    .join('\n');

  const prompt = `בהתבסס על השיחה הבאה, נסה להבין:
1. מהו השם הפרטי של המשתמש
2. מהו גילו של המשתמש

השב בתשובה בפורמט JSON תקני בלבד, לדוגמה:
{ "name": "ליאור", "age": 46 }

אם אינך יודע את אחד מהנתונים – רשום אותו כ-null:
{ "name": null, "age": null }

==== שיחה ====
${userMessages}
`;

  const messages = toLangchainMessages([
    { role: 'system', content: 'אתה כלי עזר לזיהוי שם וגיל משתמש מתוך שיחה בעברית' },
    { role: 'user', content: prompt }
  ]);

  const response = await model.invoke(messages);
  const text = response?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(text);
    return {
      name: typeof parsed.name === 'string' ? parsed.name.trim() : null,
      age: typeof parsed.age === 'number' ? parsed.age : null
    };
  } catch (err) {
    console.error('❌ extractIdentitySmart – שגיאה בפיענוח JSON:', text);
    return { name: null, age: null };
  }
}

module.exports = { extractIdentitySmart };
