// metrics/authMetrics.js
import { Counter, register } from 'prom-client';
export const authSignupCounter = new Counter({ name: 'auth_signup_total', help: 'Signups', labelNames: ['result'] });
export const authLoginCounter  = new Counter({ name: 'auth_login_total',  help: 'Logins',  labelNames: ['result'] });
export { register };

// controllers/authController.js (inside handlers)
authSignupCounter.inc({ result: 'ok' });
// on error:
authSignupCounter.inc({ result: 'error' });
