// seedUser.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Load your User model
const User = require('./models/User'); // <-- adjust path if your User model is in a different folder

async function seed() {
  try {
    // 2. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');

    const email = 'test@example.com';
    const password = 'Passw0rd!';

    // 3. Check if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log(`ℹ️ User ${email} already exists. Skipping creation.`);
    } else {
      // 4. Create the user with hashed password
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        email,
        password: hashedPassword,
        name: 'Test User',
        role: 'tester',
      });
      await user.save();
      console.log(`🎉 User ${email} created successfully`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding user:', err);
    process.exit(1);
  }
}

seed();
