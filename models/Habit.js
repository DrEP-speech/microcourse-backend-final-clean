import mongoose from 'mongoose';
const HabitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: String,
  completed: Boolean,
});
export default mongoose.model('Habit', HabitSchema);
