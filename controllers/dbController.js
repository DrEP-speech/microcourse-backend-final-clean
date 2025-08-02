import mongoose from 'mongoose';

export const dbCheck = async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
    res.json({ status: states[state] });
  } catch (err) {
    res.status(500).json({ error: 'DB Check failed', details: err.message });
  }
};
