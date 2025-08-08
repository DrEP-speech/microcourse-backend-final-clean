import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['student', 'instructor', 'admin'],
      default: 'student',
    },
    badges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
      },
    ],
    streak: {
      type: Number,
      default: 0,
    },
    lastLogin: Date,
    profileComplete: {
      type: Boolean,
      default: false,
    },
    preferences: {
      weeklyEmails: { type: Boolean, default: true },
      theme: { type: String, default: 'light' },
    },
  },
  {
    timestamps: true,
  }
);

// ✅ This prevents OverwriteModelError:
const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
