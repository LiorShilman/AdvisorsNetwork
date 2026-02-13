/**
 * מנקה ומוודא שמערך הודעות תקני עבור שימוש ב־LLM
 * @param {Array} messages - מערך הודעות גולמי
 * @returns {Array} - הודעות תקניות בלבד
 */
function sanitizeMessages(messages) {
  const allowedRoles = ['user', 'assistant', 'system'];

  return messages
    .filter(m =>
      m &&
      typeof m === 'object' &&
      typeof m.content === 'string' &&
      allowedRoles.includes(m.role)
    )
    .map(m => ({
      role: m.role,
      content: m.content.trim()
    }));
}

module.exports = { sanitizeMessages };
