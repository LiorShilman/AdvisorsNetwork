// src/models/Message.js - מודל הודעה
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    enum: ['user', 'system'],
    required: true
  },
  advisorId: {
    type: String,
    required: function() {
      return this.sender === 'system';
    }
  },
  // מטא-נתונים על ההודעה
  metadata: {
    tokens: Number, // מספר הטוקנים בהודעה
    processingTime: Number, // זמן עיבוד בשניות
    relevanceScore: Number, // ציון רלוונטיות (במקרה של תשובות מערכת)
    confidence: Number, // רמת הביטחון
    temperature: Number, // ערך ה-temperature ששימש לייצור התשובה
    model: String // מודל ששימש לייצור התשובה
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);