import { Router } from "express";
import * as c from "../controllers/admin.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { writeLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { listUsersQuery, updateRoleSchema, userIdParams } from "../validation/schemas.js";

const router = Router();

router.use(authenticate, requireAdmin);
router.get("/stats", c.getStats);
router.get("/users", validate(listUsersQuery, "query"), c.listUsers);
router.patch("/users/:id/role", writeLimiter, validate(userIdParams, "params"), validate(updateRoleSchema), c.setRole);
router.delete("/users/:id", writeLimiter, validate(userIdParams, "params"), c.deleteUser);

export default router;
