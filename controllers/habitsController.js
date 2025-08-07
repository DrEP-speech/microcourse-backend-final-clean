import Habit from '../models/Habit.js';

export const recordHabit = async (req, res) => {
  const { userId, date } = req.body;
  try {
    const today = date || new Date().toISOString().split('T')[0];
    await Habit.findOneAndUpdate(
      { userId, date: today },
      { $set: { completed: true } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record habit' });
  }
};
