require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI');
    await mongoose.connect(process.env.MONGO_URI);

    const email = process.argv[2] || 'test@example.com';
    const plain = process.argv[3] || 'Passw0rd!';
    const hash = await bcrypt.hash(plain, 10);

    let user = await User.findOne({ email });
    if (user) {
      user.passwordHash = hash;
      await user.save();
      console.log('🔁 User updated:', email);
    } else {
      user = await User.create({ email, passwordHash: hash, name: 'Test User', role: 'user' });
      console.log('✅ User created:', email);
    }
  } catch (e) {
    console.error('Seed error:', e.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
