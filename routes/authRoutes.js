import { Router } from "express";
import { signup, login, me, refresh, logoutEverywhere } from "../controllers/authController.js";
import { issueCsrf } from "../controllers/csrfController.js";
import { requireCsrf } from "../middleware/requireCsrf.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// CSRF token issuer
router.get("/csrf", issueCsrf);

// Auth endpoints (protect unsafe methods with CSRF)
router.post("/signup", requireCsrf, signup);
router.post("/login",  requireCsrf, login);
router.post("/refresh", refresh);

// Session-required endpoint(s)
router.get("/me", requireAuth, me);
router.post("/logout-everywhere", requireAuth, requireCsrf, logoutEverywhere);

export default router;
