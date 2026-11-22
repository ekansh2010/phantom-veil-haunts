import { Router } from "express";
import * as c from "../controllers/movie.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { writeLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createMovieSchema, movieIdParams, searchMoviesQuery, updateMovieSchema } from "../validation/schemas.js";

const router = Router();

// Public reads ("/search" is registered before "/:id" so it is not treated as an id)
router.get("/", c.getCategories);
router.get("/search", validate(searchMoviesQuery, "query"), c.search);
router.get("/:id", validate(movieIdParams, "params"), c.getMovie);
router.get("/:id/similar", validate(movieIdParams, "params"), c.getSimilar);

// Admin-only catalog management
router.post("/", writeLimiter, authenticate, requireAdmin, validate(createMovieSchema), c.createMovie);
router.patch("/:id", writeLimiter, authenticate, requireAdmin, validate(movieIdParams, "params"), validate(updateMovieSchema), c.updateMovie);
router.delete("/:id", writeLimiter, authenticate, requireAdmin, validate(movieIdParams, "params"), c.deleteMovie);

export default router;
