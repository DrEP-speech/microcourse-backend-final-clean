import('./routes/authRoutes.js')
  .then(m => console.log('authRoutes exports:', Object.keys(m)))
  .catch(console.error);
