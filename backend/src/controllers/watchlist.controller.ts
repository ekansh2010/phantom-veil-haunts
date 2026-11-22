import { Request, Response } from "express";
import { currentUser } from "../middleware/auth.middleware.js";
import * as watchlistService from "../services/watchlist.service.js";
import { HttpError } from "../utils/httpError.js";

type Params = { movieId: string };

export const getWatchlist = async (req: Request, res: Response) => {
  res.json(await watchlistService.listWatchlist(currentUser(req).id));
};

export const toggleWatchlist = async (req: Request, res: Response) => {
  const inWatchlist = await watchlistService.toggleWatchlist(currentUser(req).id, (req.body as { movie_id: string }).movie_id);
  res.json({ message: inWatchlist ? "Added to watchlist" : "Removed from watchlist", inWatchlist });
};

export const addToWatchlist = async (req: Request<Params>, res: Response) => {
  const created = await watchlistService.addToWatchlist(currentUser(req).id, req.params.movieId);
  res.status(created ? 201 : 200).json({ message: "Added to watchlist", inWatchlist: true });
};

export const removeFromWatchlist = async (req: Request<Params>, res: Response) => {
  const removed = await watchlistService.removeFromWatchlist(currentUser(req).id, req.params.movieId);
  if (!removed) throw HttpError.notFound("Movie is not in your watchlist");
  res.status(204).end();
};
