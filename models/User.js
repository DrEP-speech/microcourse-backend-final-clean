import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },

    // User role: for permissions
    role: {
      type: String,
      enum: ['student', 'instructor', 'admin'],
      default: 'student',
    },

    // Badge achievement system
    badges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
      },
    ],

    // Streak tracking for gamification
    streak: {
      type: Number,
      default: 0,
    },

    // Progress milestone or level (for future gamified dashboards)
    level: {
      type: Number,
      default: 1,
    },

    // Profile completion (used to encourage setup)
    profileComplete: {
      type: Boolean,
      default: false,
    },

    // Avatar/profile image
    avatarUrl: {
      type: String,
      default: '',
    },

    // Last login tracking
    lastLogin: {
      type: Date,
    },

    // Notification & UI preferences
    preferences: {
      weeklyEmails: { type: Boolean, default: true },
      theme: { type: String, default: 'light' },
      language: { type: String, default: 'en' },
    },

    // Soft delete option (future admin feature)
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// 🔒 Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Compare password for login
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ Prevent OverwriteModelError
const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
