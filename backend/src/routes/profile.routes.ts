import { Router } from "express";
import * as c from "../controllers/profile.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { writeLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { updateProfileSchema } from "../validation/schemas.js";

const router = Router();

router.use(authenticate);
router.get("/", c.getProfile);
router.put("/", writeLimiter, validate(updateProfileSchema), c.updateProfile);
router.patch("/", writeLimiter, validate(updateProfileSchema), c.updateProfile);

export default router;
