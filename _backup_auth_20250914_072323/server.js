require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

async function start() {
  try {
    if (!MONGO_URI) throw new Error('Missing MONGO_URI');
    await mongoose.connect(MONGO_URI);
    // eslint-disable-next-line no-console
    console.log('✅ Mongo connected');

    http.createServer(app).listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Startup error:', err.message);
    process.exit(1);
  }
}

start();
