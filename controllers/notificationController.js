// controllers/notificationController.js
export const sendQuizReminder = (req, res) => {
  const { userId, message } = req.body;
  // TODO: Implement push/email notification logic
  res.json({ status: "Reminder sent", userId, message });
};

export const getUserNotifications = (req, res) => {
  const userId = req.user?.id;
  // TODO: Fetch from DB
  res.json({ userId, notifications: [] });
};
