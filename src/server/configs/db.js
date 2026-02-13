// config/db.js - חיבור לבסיס נתונים MongoDB
const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../src/utils/logger');

// פונקציה להתחברות לבסיס הנתונים
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.db.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    logger.warn('⚠️  Server continuing without MongoDB - install MongoDB or configure Atlas to use the database');
    // Temporary: Don't exit, allow server to run without DB for testing
    // process.exit(1);
    return null;
  }
};

module.exports = connectDB;