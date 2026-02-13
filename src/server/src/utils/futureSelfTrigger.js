// 📁 futureSelfTrigger.js – מעבר אוטומטי לעצמי העתידי

function maybeTriggerFutureSelf(conversation, response, userAge = null, mfplScore = null) {
  if (!conversation?.state?.previousAdvisors) return;

  const distinctAdvisors = new Set(conversation.state.previousAdvisors);
  const current = conversation.state.currentAdvisor;
  if (current) distinctAdvisors.add(current);

  const alreadySuggested = conversation.state.futureSelfSuggested;
  const alreadyInFutureSelf = conversation.state.currentAdvisor === 'futureself';

  if (alreadyInFutureSelf || alreadySuggested) return;

  const hasSufficientAdvisors = distinctAdvisors.size >= 3;
  const ageTrigger = userAge && (userAge + 20 >= 60); // גיל 40 ומעלה
  const mfplTrigger = typeof mfplScore === 'number' && mfplScore >= 15;

  if ((hasSufficientAdvisors || ageTrigger || mfplTrigger) && !alreadySuggested) {
    conversation.state.futureSelfSuggested = true;

    const targetAge = userAge ? userAge + 25 : 65;
    const handoffText = `רוצה לשמוע מה ${conversation.state.userName || 'העצמי שלך'} בגיל ${targetAge} חושב על הדרך שעשית והבחירות הכלכליות שלך?`;

    response.nextAdvisor = {
      advisorId: 'futureself',
      reason: 'המשתמש עבר דרך מהותית או הגיע לשלב שמתאים להתבוננות קדימה.',
      handoffText
    };
  }
}
  
  module.exports = {
    maybeTriggerFutureSelf
  };
  