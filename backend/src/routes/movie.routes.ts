import { Router } from "express";
import * as c from "../controllers/movie.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { writeLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { browseMoviesQuery, createMovieSchema, movieIdParams, searchMoviesQuery, updateMovieSchema } from "../validation/schemas.js";

const router = Router();

// Public reads ("/search", "/browse", "/meta" are registered before "/:id" so they are not treated as ids)
router.get("/", c.getCategories);
router.get("/search", validate(searchMoviesQuery, "query"), c.search);
router.get("/browse", validate(browseMoviesQuery, "query"), c.browse);
router.get("/meta", c.meta);
router.get("/:id", validate(movieIdParams, "params"), c.getMovie);
router.get("/:id/similar", validate(movieIdParams, "params"), c.getSimilar);

// Admin-only catalog management
router.post("/", writeLimiter, authenticate, requireAdmin, validate(createMovieSchema), c.createMovie);
router.patch("/:id", writeLimiter, authenticate, requireAdmin, validate(movieIdParams, "params"), validate(updateMovieSchema), c.updateMovie);
router.delete("/:id", writeLimiter, authenticate, requireAdmin, validate(movieIdParams, "params"), c.deleteMovie);

export default router;
