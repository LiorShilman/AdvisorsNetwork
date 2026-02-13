// 📁 mapalPromptUtils.js – הוספת הדרכה על מדד מפ"ל ל־systemPrompt

const DOMAIN_PROMPTS = {
    planning: "בתחום זה אנחנו בוחנים את היכולת של המשתמש לנהל תקציב, לזהות צרכים ולהתאים הכנסות להוצאות.",
    protection: "בתחום זה אנחנו בודקים את הכיסוי הביטוחי של המשתמש, כולל ניתוח סיכונים אישיים ומשפחתיים.",
    investment: "בתחום זה אנחנו מתמקדים ביכולת של המשתמש להבין אפיקי השקעה, רמת סיכון, ותמהיל תיק השקעות.",
    retirement: "בתחום זה נבחן את מוכנות המשתמש לעתיד – פרישה, פנסיה וקצבה.",
    behavior: "בתחום זה ננתח את הרגלי הצריכה וההתנהגות הכלכלית של המשתמש לאורך זמן."
  };
  
  function getMapalGuidanceText(advisorId) {
    const domainKey = getDomainFromAdvisor(advisorId);
    const domainDescription = DOMAIN_PROMPTS[domainKey] || "בתחום זה תבחן רמת ההבנה וההתקדמות של המשתמש בנוגע להיבט חשוב בהתנהלות הכלכלית שלו.";
  
    return `\n\n---\n\n### 📊 מדד המוכנות הפיננסית (מפ\"ל):\n
  ${domainDescription}
  
  במהלך השיחה, ננתח גם את **רמת ההתפתחות הפיננסית של המשתמש** בתחום זה.  
  בכל מענה מהותי, יתווסף ניקוד מדורג למדד מפ\"ל.
  
  אם נראה שהמשתמש עבר שלב, החזר לו טקסט תיאורי כגון:
  _"נראה שאתה עובר משלב המיפוי הבסיסי לשלב של בניית תשתית."_  
  אין להזכיר אחוזים או ציונים ישירים – רק תיאור מילולי אנושי.\n`;
  }
  
  function getDomainFromAdvisor(advisorId) {
    const map = {
      strategy: 'planning',
      budget: 'planning',
      protection: 'protection',
      insurance: 'protection',
      investments: 'investment',
      savings: 'investment',
      pension: 'retirement',
      retirement: 'retirement',
      behavior: 'behavior',
      emotional: 'behavior'
    };
    return map[advisorId] || 'planning';
  }
  
  module.exports = {
    getMapalGuidanceText
  };
  