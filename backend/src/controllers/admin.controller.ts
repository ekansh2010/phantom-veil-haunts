import { Request, Response } from "express";
import { currentUser } from "../middleware/auth.middleware.js";
import type { Role } from "../models/index.js";
import * as adminService from "../services/admin.service.js";

type Params = { id: string };

export const getStats = async (_req: Request, res: Response) => {
  res.json(await adminService.getStats());
};

export const listUsers = async (req: Request, res: Response) => {
  const { q, page, limit } = req.query as unknown as { q: string; page: number; limit: number };
  res.json(await adminService.listUsers(q, page, limit));
};

export const setRole = async (req: Request<Params>, res: Response) => {
  res.json(await adminService.setRole(currentUser(req).id, req.params.id, (req.body as { role: Role }).role));
};

export const deleteUser = async (req: Request<Params>, res: Response) => {
  await adminService.deleteUser(currentUser(req).id, req.params.id);
  res.status(204).end();
};
