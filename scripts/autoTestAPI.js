// scripts/autoTestAPI.js

import axios from 'axios';

const BASE_URL = 'https://microcourse-backend-final-clean.onrender.com';

const endpoints = [
  '/',
  '/api/quizzes',
  '/api/users',
  '/api/quizzes/submit',
  '/api/email/logs',
  '/api/analytics/teacher/summary-insights',
];

async function testEndpoint(endpoint) {
  try {
    const res = await axios.get(`${BASE_URL}${endpoint}`);
    console.log(`✅ ${endpoint} → ${res.status}`);
  } catch (err) {
    console.error(`❌ ${endpoint} → ${err?.response?.status || 'Error'}`);
  }
}

(async () => {
  console.log('🔎 Running API Auto-Test...');
  for (const ep of endpoints) {
    await testEndpoint(ep);
  }
})();
