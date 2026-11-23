import { Router } from "express";
import * as c from "../controllers/cron.controller.js";
import { requireCronSecret } from "../middleware/cron.middleware.js";

const router = Router();

// Vercel Cron issues GET requests (see vercel.json "crons").
router.get("/sync", requireCronSecret, c.sync);

export default router;
