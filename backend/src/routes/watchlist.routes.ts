import { Router } from "express";
import * as c from "../controllers/watchlist.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { writeLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { toggleWatchlistSchema, watchlistParams } from "../validation/schemas.js";

const router = Router();

router.use(authenticate);
router.get("/", c.getWatchlist);
router.post("/", writeLimiter, validate(toggleWatchlistSchema), c.toggleWatchlist);
router.put("/:movieId", writeLimiter, validate(watchlistParams, "params"), c.addToWatchlist);
router.delete("/:movieId", writeLimiter, validate(watchlistParams, "params"), c.removeFromWatchlist);

export default router;
