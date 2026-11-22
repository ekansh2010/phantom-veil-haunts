import { Router } from "express";
import * as c from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authLimiter, resetLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../validation/schemas.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), c.register);
router.post("/login", authLimiter, validate(loginSchema), c.login);
router.get("/me", authenticate, c.me);
router.post("/logout", authenticate, c.logout);
router.post("/change-password", authLimiter, authenticate, validate(changePasswordSchema), c.changePassword);
router.post("/forgot-password", resetLimiter, validate(forgotPasswordSchema), c.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), c.resetPassword);

export default router;
