import { Request, Response } from "express";
import * as movieService from "../services/movie.service.js";

type Params = { id: string };

export const getCategories = async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  res.json(await movieService.getCategories());
};

export const search = async (req: Request, res: Response) => {
  const { q, genre, page, limit } = req.query as unknown as { q: string; genre: string; page: number; limit: number };
  res.json(await movieService.searchMovies(q, genre, page, limit));
};

export const browse = async (req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  res.json(await movieService.browseMovies(req.query as unknown as movieService.BrowseQuery));
};

export const meta = async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=60, s-maxage=300");
  res.json(await movieService.getCatalogMeta());
};

export const getMovie = async (req: Request<Params>, res: Response) => {
  res.json(await movieService.getMovie(req.params.id));
};

export const getSimilar = async (req: Request<Params>, res: Response) => {
  res.json(await movieService.getSimilar(req.params.id));
};

export const createMovie = async (req: Request, res: Response) => {
  res.status(201).json(await movieService.createMovie(req.body));
};

export const updateMovie = async (req: Request<Params>, res: Response) => {
  res.json(await movieService.updateMovie(req.params.id, req.body));
};

export const deleteMovie = async (req: Request<Params>, res: Response) => {
  await movieService.deleteMovie(req.params.id);
  res.status(204).end();
};
