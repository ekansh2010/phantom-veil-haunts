import { env, isProd, isTest } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface OutgoingMail {
  to: string;
  subject: string;
  link: string;
}

/** Captured messages under NODE_ENV=test so integration tests can read reset links. */
export const testOutbox: OutgoingMail[] = [];

/**
 * Delivers a password reset link. No email provider is wired up yet (see README
 * follow-ups): in development the link is logged so the flow can be exercised
 * locally; in production nothing sensitive is logged.
 */
export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  const link = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
  const mail: OutgoingMail = { to, subject: "Reset your Phantom Veil password", link };

  if (isTest) {
    testOutbox.push(mail);
    return;
  }
  if (isProd) {
    logger.warn("Password reset requested but no email transport is configured; link was not delivered.");
    return;
  }
  logger.info(`[dev mail] Password reset link for ${to}: ${link}`);
};
