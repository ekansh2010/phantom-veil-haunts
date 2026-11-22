import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Role, User } from "../models/index.js";
import { HttpError } from "../utils/httpError.js";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload extends jwt.JwtPayload {
  sub: string;
  tv?: number;
}

export const signToken = (user: { id: string; tokenVersion?: number }): string =>
  jwt.sign({ tv: user.tokenVersion ?? 0 }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

const extractBearer = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};

/**
 * Verifies the JWT and re-loads the user so that deleted users, role changes,
 * logouts and password changes (tokenVersion bumps) take effect immediately.
 * The role always comes from the database, never from the token.
 */
export const resolveUser = async (token: string): Promise<AuthUser | null> => {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as TokenPayload;
  } catch {
    return null;
  }
  if (!payload?.sub) return null;

  const user = await User.findOne({ id: payload.sub }, { id: 1, email: 1, username: 1, role: 1, tokenVersion: 1 }).lean();
  if (!user) return null;
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) return null;
  return { id: user.id, email: user.email, username: user.username, role: user.role };
};

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearer(req);
  if (!token) return next(HttpError.unauthorized("Access token is missing"));
  const user = await resolveUser(token);
  if (!user) return next(HttpError.unauthorized("Token is invalid or expired"));
  req.user = user;
  next();
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") return next(HttpError.forbidden("Admin access required"));
  next();
};

/** Narrowing helper for handlers mounted behind `authenticate`. */
export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
};
