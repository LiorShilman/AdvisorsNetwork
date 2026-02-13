const AdvisorEngine = require('./../utils/advisorEngine');
import { buildChatMessages, routeByConversationStage } from './chatPromptBuilder.js';

/**
 * Handles a user message and returns a full GPT-ready payload with routing logic
 * @param {string} advisorId - ID of the current advisor
 * @param {Array} history - Previous messages
 * @param {string} userMessage - New user input
 * @param {boolean} isFirstMessage - If this is the first user input
 * @returns {{ messages: any[], advisor: object, stage: string, systemReply: string }}
 */
export function handleMessage(advisorId, history, userMessage, isFirstMessage = false) {
  const advisor = AdvisorEngine.getAdvisorById(advisorId) || detectAdvisorByMessage(userMessage);

  if (!advisor) {
    throw new Error('לא נמצא יועץ מתאים.');
  }

  const messages = buildChatMessages(advisor, history, userMessage, isFirstMessage);
  const stage = messages.conversationStage;
  const systemReply = routeByConversationStage(stage, advisor);

  return {
    advisor,
    stage,
    messages,
    systemReply
  };
}

