/* eslint-disable no-console */
const { loadEnv } = require("../src/config/env");
const { connectDB } = require("../src/config/db");

const User = require("../src/models/User");
const Course = require("../src/models/Course");
const Lesson = require("../src/models/Lesson");
const Quiz = require("../src/models/Quiz");
const QuizResult = require("../src/models/QuizResult");
const Notification = require("../src/models/Notification");
const EmailLog = require("../src/models/EmailLog");
const Badge = require("../src/models/Badge");

async function main() {
  loadEnv();
  await connectDB();

  // Ensure indexes
  await Promise.all([
    User.syncIndexes(),
    Course.syncIndexes(),
    Lesson.syncIndexes(),
    Quiz.syncIndexes(),
    QuizResult.syncIndexes(),
    Notification.syncIndexes(),
    EmailLog.syncIndexes(),
    Badge.syncIndexes()
  ]);

  console.log("✅ Index migration complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ migrate failed:", e);
  process.exit(1);
});
