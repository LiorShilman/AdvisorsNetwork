class MessageTagger {


  /**
   * Attempts to extract the appropriate questionKey from the last assistant message
   * @param {object} advisor - The advisor object with keyQuestions
   * @param {object} lastAssistantMessage - The assistant's latest message object
   * @returns {string|null} - The matched questionKey or null
   */
  extractQuestionKeyFromLastAssistantMessage(advisor, lastAssistantMessage) {
    if (!advisor?.keyQuestions || !lastAssistantMessage?.content) return null;

    const normalize = (text) =>
      text.replace(/[^֐-׿a-zA-Z0-9\s]/g, '').trim().toLowerCase();

    const normalizedLastMsg = normalize(lastAssistantMessage.content);

    for (const q of advisor.keyQuestions) {
      if (normalizedLastMsg.includes(normalize(q.question))) {
        return q.key;
      }
    }

    return null;
  }

  /**
   * Adds questionKey to the user message based on the previous assistant message
   * @param {Array<{ role: string, content: string, questionKey?: string }>} messages
   * @param {string} userMessage
   * @param {object} advisor
   * @returns {Array<{ role: string, content: string, questionKey?: string }>}
   */
  tagUserMessageWithQuestionKey(messages, userMessage, advisor) {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    const questionKey = this.extractQuestionKeyFromLastAssistantMessage(advisor, lastAssistantMessage);

    const taggedUserMessage = {
      role: 'user',
      content: userMessage,
      ...(questionKey && { questionKey })
    };

    return [...messages, taggedUserMessage];
  }
}

module.exports = new MessageTagger();
