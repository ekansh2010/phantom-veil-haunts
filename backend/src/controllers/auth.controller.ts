import { Request, Response } from "express";
import { env } from "../config/env.js";
import { currentUser } from "../middleware/auth.middleware.js";
import * as authService from "../services/auth.service.js";

const RESET_MESSAGE = "If that email exists in our records, a password reset link has been sent.";

/** `session` mirrors the shape the original Supabase-based UI read (`session.access_token`). */
const withSession = (result: authService.AuthResult) => ({
  ...result,
  session: { access_token: result.token, token_type: "bearer", expires_in: env.JWT_EXPIRES_IN },
});

export const register = async (req: Request, res: Response) => {
  res.status(201).json(withSession(await authService.register(req.body)));
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  res.json(withSession(await authService.login(email, password)));
};

export const me = async (req: Request, res: Response) => {
  res.json({ user: await authService.getUser(currentUser(req).id) });
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout(currentUser(req).id);
  res.json({ message: "Signed out" });
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const result = await authService.changePassword(currentUser(req).id, currentPassword, newPassword);
  res.json({ message: "Password updated", ...withSession(result) });
};

export const forgotPassword = async (req: Request, res: Response) => {
  await authService.requestPasswordReset((req.body as { email: string }).email);
  res.json({ message: RESET_MESSAGE });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password);
  res.json({ message: "Password updated. Please sign in with your new password." });
};
