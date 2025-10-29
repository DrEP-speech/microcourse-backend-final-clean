'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const path     = require('path');

// Resolve the User model regardless of where we run from
const User = require(path.join(process.cwd(), 'models', 'User.js'));

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/microcourse';
  const email = process.env.SEED_OWNER_EMAIL || 'owner@example.com';
  const password = process.env.SEED_OWNER_PASS  || 'passw0rd';
  const role = process.env.SEED_OWNER_ROLE || 'owner';

  try {
    await mongoose.connect(uri, { autoIndex: true });
    const hash = await bcrypt.hash(password, 10);

    let user = await User.findOne({ email }).select('+password');
    if (!user) {
      user = await User.create({ email, password: hash, role });
      console.log('[seed] created', { email, role });
    } else {
      user.password = hash;
      user.role = role;
      await user.save();
      console.log('[seed] updated', { email, role });
    }
    await mongoose.connection.close();
    process.exit(0);
  } catch (e) {
    console.error('[seed] failed', e);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
})();
