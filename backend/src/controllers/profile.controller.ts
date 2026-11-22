import { Request, Response } from "express";
import { currentUser } from "../middleware/auth.middleware.js";
import * as profileService from "../services/profile.service.js";

export const getProfile = async (req: Request, res: Response) => {
  res.json(await profileService.getProfile(currentUser(req).id));
};

export const updateProfile = async (req: Request, res: Response) => {
  res.json(await profileService.updateProfile(currentUser(req).id, req.body));
};
