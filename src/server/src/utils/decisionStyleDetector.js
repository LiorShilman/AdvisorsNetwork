// 📁 decisionStyleDetector.js – זיהוי סגנון קבלת החלטות של המשתמש

const emotionalKeywords = [
    'מפחד', 'חשש', 'מרגיש', 'לא נוח לי', 'לחץ', 'לא בטוח', 'רגשית', 'חוסר ביטחון', 'חרדה', 'בטוח לי יותר', 'נעים לי'
  ];
  
  const rationalKeywords = [
    'תשואה', 'סיכון', 'חישוב', 'אחוזים', 'ניתוח', 'השוואה', 'חיסכון', 'טווח ארוך', 'נתונים', 'תוכנית', 'תועלת'
  ];
  
  function detectDecisionStyle(conversation) {
    if (!conversation?.history) return;
  
    let emotionalScore = 0;
    let rationalScore = 0;
  
    conversation.history.forEach(msg => {
      if (msg.role === 'user' && msg.content) {
        const text = msg.content.toLowerCase();
  
        emotionalKeywords.forEach(word => {
          if (text.includes(word)) emotionalScore++;
        });
  
        rationalKeywords.forEach(word => {
          if (text.includes(word)) rationalScore++;
        });
      }
    });
  
    let style = 'neutral';
    if (emotionalScore > rationalScore) style = 'emotional';
    else if (rationalScore > emotionalScore) style = 'rational';
    else if (emotionalScore > 0 && rationalScore > 0) style = 'mixed';
  
    conversation.state.decisionStyle = {
      style,
      emotionalScore,
      rationalScore
    };
  }
  
  function renderDecisionStyleMarkdown(styleObj) {
    if (!styleObj) return '';
  
    const labels = {
      emotional: '❤️ סגנון רגשי – ההחלטות שלך מושפעות בעיקר מתחושות, פחדים או ביטחון אישי.',
      rational: '🧠 סגנון רציונלי – אתה מקבל החלטות לפי נתונים, סיכונים ותועלות.',
      mixed: '🎭 סגנון משולב – אתה משלב בין הרגש להיגיון בהחלטותיך.',
      neutral: '❓ טרם זוהה סגנון החלטה ברור.'
    };
  
    return `**סגנון קבלת ההחלטות שלך:**\n${labels[styleObj.style] || labels.neutral}\n\n` +
      `• נקודות רגשיות שזוהו: ${styleObj.emotionalScore}  
  • נקודות רציונליות שזוהו: ${styleObj.rationalScore}`;
  }
  
  module.exports = {
    detectDecisionStyle,
    renderDecisionStyleMarkdown
  };
  