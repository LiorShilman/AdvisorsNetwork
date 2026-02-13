// src/utils/logger.js - מערכת רישום לוגים
const winston = require('winston');
const config = require('../../configs/config');

// הגדרת הפורמט עבור הלוגים
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  config.logging.format === 'json'
    ? winston.format.json()
    : winston.format.printf(info => {
        return `${info.timestamp} ${info.level}: ${info.message}${
          info.stack ? '\n' + info.stack : ''
        }`;
      })
);

// יצירת מופע Logger
const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format,
  defaultMeta: { service: 'financial-advisors-api' },
  transports: [
    // לוגים לקונסול
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // לוגים לקובץ (בסביבת פרודקשן)
    ...(config.env === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' })
        ]
      : [])
  ]
});

// יצירת ספריית לוגים אם לא קיימת
const fs = require('fs');
const path = require('path');
if (config.env === 'production') {
  const logDir = 'logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
}

// הוספת פונקציות עזר שימושיות ללוגר

// לוגים של התחלת/סיום תהליכים
logger.logProcess = (processName, status, details = {}) => {
  const message = `Process ${processName} ${status}`;
  if (status === 'started') {
    logger.info(message, { process: processName, status, ...details });
  } else if (status === 'completed') {
    logger.info(message, { process: processName, status, ...details });
  } else if (status === 'failed') {
    logger.error(message, { process: processName, status, ...details });
  }
};

// לוג של כל ההודעות שמתקבלות ונשלחות לרשת היועצים
logger.trackConversation = (type, data) => {
  if (type === 'user-message') {
    logger.info(`USER: ${data.text}`, { type, data });
  } else if (type === 'advisor-message') {
    logger.info(`ADVISOR [${data.advisorId}]: ${data.text}`, { type, data });
  } else if (type === 'system-event') {
    logger.debug(`SYSTEM: ${JSON.stringify(data)}`, { type, data });
  }
};

// לוג מידע שנאסף על המשתמש
logger.userInfo = (userId, infoType, data) => {
  logger.info(`User info collected - ${infoType}`, { userId, infoType, data });
};

// לוג החלפת יועץ
logger.advisorSwitch = (conversationId, fromAdvisor, toAdvisor, reason) => {
  logger.info(`Advisor switch: ${fromAdvisor} -> ${toAdvisor}`, { 
    conversationId, 
    fromAdvisor, 
    toAdvisor, 
    reason 
  });
};

// בדיקה האם הסביבה היא פיתוח
if (config.env === 'development') {
  logger.debug('Logger initialized in development mode');
}

module.exports = logger;